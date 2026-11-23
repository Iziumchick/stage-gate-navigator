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
    smtp.add_argument('--to',required=True,help='Your own permitted OTH email address')
    args=parser.parse_args(argv)
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
