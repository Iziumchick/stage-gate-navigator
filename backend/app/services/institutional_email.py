"""Institutional mailbox proof and encrypted SMTP delivery; no code logging."""
import os
import re
import smtplib
import ssl
from email.message import EmailMessage
from email.utils import parseaddr, formatdate, make_msgid
from app.services.security import production

ALLOWED_DOMAINS=('st.oth-regensburg.de','oth-regensburg.de')


def required():
    # Public deployments cannot silently fall back to unverified accounts.
    return production() or os.getenv('REQUIRE_INSTITUTIONAL_EMAIL','false')=='true'


def allowed(email):
    parts=email.strip().split('@')
    display,address=parseaddr(email)
    return len(parts)==2 and bool(parts[0]) and not display and address==email and not any(c.isspace() for c in email) and parts[1].lower() in ALLOWED_DOMAINS


class MailUnavailable(Exception):
    pass


def smtp_config():
    host=os.getenv('SMTP_HOST','').strip()
    sender=os.getenv('SMTP_FROM','').strip()
    security=os.getenv('SMTP_SECURITY','starttls').strip()
    try:port=int(os.getenv('SMTP_PORT','587'))
    except ValueError:raise MailUnavailable() from None
    display,address=parseaddr(sender)
    if not host or display or address!=sender or not re.fullmatch(r'[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+',sender) or security not in ('starttls','ssl') or not 1<=port<=65535:
        raise MailUnavailable()
    username=os.getenv('SMTP_USER','')
    password=os.getenv('SMTP_PASSWORD','')
    if bool(username)!=bool(password):raise MailUnavailable()
    return host,port,sender,security,username,password


def assert_ready():
    if not required():return
    try:smtp_config()
    except MailUnavailable:raise RuntimeError('Institutional access requires configured TLS SMTP delivery.') from None
    admin=os.getenv('ADMIN_EMAIL','').strip()
    if admin and not allowed(admin):raise RuntimeError('Institutional access requires an administrator email in the permitted OTH domains.')


def send_verification(email,code):
    _,_,sender,_,_,_=smtp_config()
    message=EmailMessage()
    message['From']=sender
    message['To']=email
    message['Subject']='Study Navigator: E-Mail-Adresse bestätigen'
    message['Auto-Submitted']='auto-generated'
    message['X-Auto-Response-Suppress']='All'
    message.set_content(f'''Dein Bestätigungscode für Study Navigator lautet:

{code}

Der Code ist 10 Minuten gültig und kann nur einmal verwendet werden.
Gib ihn ausschließlich im Anmeldefenster ein, in dem du ihn angefordert hast.

Study Navigator ist ein privat betriebenes Projekt im Rahmen einer Bachelorarbeit,
kein offizieller Dienst der OTH Regensburg. Diese E-Mail enthält keine Leistungsdaten.
Wenn du keinen Code angefordert hast, kannst du diese Nachricht ignorieren.
''')
    deliver(message)


def send_test(email):
    """Explicit operator-run delivery test; no account, grades or verification code."""
    if not allowed(email):raise MailUnavailable()
    _,_,sender,_,_,_=smtp_config()
    message=EmailMessage()
    message['From']=sender
    message['To']=email
    message['Subject']='Study Navigator: SMTP-Zustellungstest'
    message['Auto-Submitted']='auto-generated'
    message.set_content('Dies ist ein ausdrücklich angeforderter Zustellungstest des Betreibers von Study Navigator.\nEs wurde kein Konto angelegt. Diese Nachricht enthält keine Leistungsdaten und keinen Bestätigungscode.\nStudy Navigator ist ein privates Bachelorarbeitsprojekt und kein offizieller OTH-Dienst.\n')
    deliver(message)


def deliver(message):
    host,port,_,security,username,password=smtp_config()
    message['Date']=formatdate(localtime=False,usegmt=True)
    message['Message-ID']=make_msgid(domain=message['From'].split('@')[-1])
    try:
        context=ssl.create_default_context()
        if security=='ssl':
            connection=smtplib.SMTP_SSL(host,port,timeout=10,context=context)
        else:
            connection=smtplib.SMTP(host,port,timeout=10)
        with connection as smtp:
            if security=='starttls':smtp.starttls(context=context)
            if username:smtp.login(username,password)
            smtp.send_message(message)
    except (OSError,smtplib.SMTPException,ValueError):
        # Never expose provider responses, recipient addresses, codes or credentials.
        raise MailUnavailable() from None
