"""Operator-only CLI. Never expose SMTP secrets or add a mail-sending HTTP route."""
import argparse
import sys
from app.services.privacy_config import notice,assert_production_ready
from app.services.institutional_email import MailUnavailable,smtp_config,send_test
from app.services.security import production


def main(argv=None):
    parser=argparse.ArgumentParser(description='Study Navigator deployment checks')
    commands=parser.add_subparsers(dest='command',required=True)
    commands.add_parser('check',help='Validate configuration without sending email')
    smtp=commands.add_parser('smtp-test',help='Send one test email; delivery must be checked in the recipient mailbox')
    smtp.add_argument('--to',required=True,help='Your own permitted OTH address or the exact configured administrator address')
    provision=commands.add_parser('provision-admin',help='Explicitly provision the exact ADMIN_EMAIL using the private ADMIN_PASSWORD; email confirmation remains required')
    provision.add_argument('--email',required=True)
    provision.add_argument('--adopt-existing',action='store_true',help='Explicitly convert this existing study account to an administrator, retaining its study data')
    provision.add_argument('--reset-password',action='store_true',help='Explicitly replace an existing administrator password from ADMIN_PASSWORD and require new email confirmation')
    grant=commands.add_parser('grant-admin',help='Grant administrator access to an existing verified staff account @oth-regensburg.de')
    grant.add_argument('--email',required=True)
    revoke=commands.add_parser('revoke-admin',help='Revoke a delegated administrator role and invalidate its sessions')
    revoke.add_argument('--email',required=True)
    args=parser.parse_args(argv)
    if args.command in ('provision-admin','grant-admin','revoke-admin'):
        # Import lazily: configuration checks and SMTP tests must not open a DB.
        from app.services.administration import AdministrationError,provision_admin,grant_staff_admin,revoke_admin
        try:
            if args.command=='provision-admin':result=provision_admin(args.email,adopt_existing=args.adopt_existing,reset_password=args.reset_password)
            elif args.command=='grant-admin':result=grant_staff_admin(args.email)
            else:result=revoke_admin(args.email)
        except AdministrationError as error:
            print(str(error),file=sys.stderr);return 1
        print(result);return 0
    if args.command=='smtp-test':
        try:send_test(args.to)
        except MailUnavailable:
            print('SMTP test failed. Check TLS, authentication, sender approval and outbound firewall rules. Provider responses and secrets are not printed.',file=sys.stderr)
            return 1
        print('SMTP accepted the test message. This does not prove inbox delivery: check the mailbox, spam folder and message authentication results.')
        return 0
    info=notice()
    missing=[key for key,value in info.items() if isinstance(value,str) and not value]
    if missing: print('Missing public information: '+', '.join(missing))
    if not info['ready']:print('Public information must be completed and reviewed before release.')
    if not production():print('APP_ENV is not production. This configuration is not ready for a public personal-data service.')
    try:smtp_config();mail_ready=True
    except MailUnavailable:mail_ready=False;print('TLS SMTP configuration is incomplete or invalid.')
    try:assert_production_ready()
    except RuntimeError as error:print(str(error));return 1
    if not production() or not info['ready'] or not mail_ready:return 1
    print('Configuration checks passed. Server hardening, real delivery, backup restoration and published notices still require operational verification.')
    return 0


if __name__=='__main__':sys.exit(main())
