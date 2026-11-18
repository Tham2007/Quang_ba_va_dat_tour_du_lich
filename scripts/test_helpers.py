import docx
from docx.shared import Inches, Pt, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.table import WD_TABLE_ALIGNMENT
from docx.oxml import parse_xml, OxmlElement
from docx.oxml.ns import nsdecls, qn

doc = docx.Document()
tbl = doc.add_table(rows=2, cols=2)
tcPr = tbl.rows[0].cells[0]._tc.get_or_add_tcPr()
shd = parse_xml(f'<w:shd {nsdecls("w")} w:fill="1B365D"/>')
tcPr.append(shd)

doc.save("test_shading.docx")
print("Shading test success!")
