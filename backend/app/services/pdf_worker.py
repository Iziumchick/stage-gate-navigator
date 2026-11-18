"""Disposable PDF parser process. No database, credentials or document files."""
import json
import sys


def main():
    try:
        import resource
        resource.setrlimit(resource.RLIMIT_AS,(384*1024*1024,384*1024*1024))
        resource.setrlimit(resource.RLIMIT_CPU,(10,10))
        resource.setrlimit(resource.RLIMIT_FSIZE,(0,0))
        resource.setrlimit(resource.RLIMIT_CORE,(0,0))
        from app.services.pdf_service import inspect_student_pdf
        from app.services.leistungen_import import parse_leistungen
        data=sys.stdin.buffer.read(10*1024*1024+1)
        inspect_student_pdf(data)
        result={'ok':True,'parsed':parse_leistungen(data)}
    except Exception as error:
        from app.services.leistungen_import import ExportError
        from app.services.pdf_service import PdfValidationError,PdfProcessingError
        if isinstance(error,(ExportError,PdfValidationError,PdfProcessingError)):
            result={'ok':False,'message':getattr(error,'safe_message',str(error)),'code':getattr(error,'code','invalid_pdf')}
        else:result={'ok':False,'message':'Die PDF konnte nicht sicher verarbeitet werden. Bitte die Leistungen erneut exportieren.','code':'invalid_pdf'}
    sys.stdout.write(json.dumps(result,ensure_ascii=False))

if __name__=='__main__':main()
