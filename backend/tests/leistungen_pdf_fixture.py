"""Synthetic table export; no student identities or original documents."""
import pymupdf

def pdf_export(rows=None, *, total=7, average=2.7, shift=0, source_po='20232', page_height=680):
    doc=pymupdf.open(); page=None; y=0
    heads={'Titel':25,'Nummer':230,'Versuch':270,'Rücktritt':310,'Bewertung':355,'Bonus':400,'Malus':435,'Status':470,'Freiversuch':510,'Freigabedatum':570}
    def new_page():
        nonlocal page,y
        page=doc.new_page(width=680+shift,height=page_height);y=60
        page.insert_text((25,25),'Leistungen')
        page.insert_text((25,40),f'84|IW|-|-|H|{source_po}',fontsize=7)
        for title,x in heads.items():page.insert_text((x+shift,60),title,fontsize=6)
        y=85
    def row(title,code,short,grade,ects,status,attempt=1):
        nonlocal y
        if y>page_height-60:new_page()
        def cell(key,value):
            if value is not None:page.insert_text((heads[key]+shift,y),str(value),fontsize=7)
        page.insert_text((55+shift,y),title,fontsize=7)
        cell('Nummer',f'IW {source_po}');cell('Versuch',attempt);cell('Rücktritt','Nein' if len(code)>5 else None)
        cell('Bewertung',grade);cell('Bonus',ects);cell('Status',status)
        page.insert_text((heads['Nummer']+shift,y+10),code,fontsize=7)
        page.insert_text((heads['Nummer']+shift,y+20),short,fontsize=7)
        y+=38
    new_page();row('Gesamtkonto','9000','GK',average,total,'PV')
    if rows is None:
        rows=[('Mathematik 1','10007','M7',2.7,7,'BE',1),('Mathematik 1','4710070','MA1',5.0,0,'NB',1),('Mathematik 1','4710070','MA1',2.7,7,'BE',2)]
    for args in rows:row(*args)
    data=doc.tobytes();doc.close();return data
