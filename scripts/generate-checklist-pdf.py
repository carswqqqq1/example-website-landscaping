#!/usr/bin/env python3
"""Rebuild downloads/project-planning-checklist.pdf from the print HTML.

Usage: python3 scripts/generate-checklist-pdf.py
Needs reportlab. Reads downloads/project-planning-checklist-print.html (eyebrow,
h1, intro, sections, footer) so the PDF and the HTML stay in step, and prints no
browser header or footer (no dates, file paths or URLs).
"""
import html
import os
import re

from reportlab.lib import colors
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import inch
from reportlab.platypus import KeepTogether, Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'downloads', 'project-planning-checklist-print.html')
OUT = os.path.join(ROOT, 'downloads', 'project-planning-checklist.pdf')

INK = colors.HexColor('#173226')
EYEBROW = colors.HexColor('#3f6a56')
MUTED = colors.HexColor('#42564d')
FOOT = colors.HexColor('#5e7068')
BORDER = colors.HexColor('#d9d1c5')
PANEL = colors.HexColor('#faf7f3')


def text(fragment):
    return html.unescape(re.sub(r'<[^>]+>', '', fragment)).strip()


def esc(value):
    return value.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;')


source = open(SRC, encoding='utf-8').read()
title = text(re.search(r'<title>(.*?)</title>', source, re.S).group(1))
eyebrow = text(re.search(r'<p class="eyebrow">(.*?)</p>', source, re.S).group(1))
heading = text(re.search(r'<h1>(.*?)</h1>', source, re.S).group(1))
intro = text(re.search(r'<p class="intro">(.*?)</p>', source, re.S).group(1))
footer = text(re.search(r'<p class="footer">(.*?)</p>', source, re.S).group(1))
sections = []
for block in re.findall(r'<section class="section">(.*?)</section>', source, re.S):
    sections.append((
        text(re.search(r'<h2>(.*?)</h2>', block, re.S).group(1)),
        [text(item) for item in re.findall(r'<li>(.*?)</li>', block, re.S)],
    ))

styles = {
    'eyebrow': ParagraphStyle('eyebrow', fontName='Helvetica', fontSize=9, leading=12, textColor=EYEBROW, spaceAfter=8),
    'h1': ParagraphStyle('h1', fontName='Helvetica-Bold', fontSize=26, leading=29, textColor=INK, spaceAfter=10),
    'intro': ParagraphStyle('intro', fontName='Helvetica', fontSize=11, leading=16, textColor=MUTED, spaceAfter=6),
    'h2': ParagraphStyle('h2', fontName='Helvetica-Bold', fontSize=13, leading=17, textColor=INK, spaceAfter=6),
    'li': ParagraphStyle('li', fontName='Helvetica', fontSize=10.5, leading=15, textColor=INK, leftIndent=14, bulletIndent=2, spaceBefore=3),
    'footer': ParagraphStyle('footer', fontName='Helvetica', fontSize=10, leading=14, textColor=FOOT, spaceBefore=16),
}

story = [
    Paragraph(esc(eyebrow.upper()), styles['eyebrow']),
    Paragraph(esc(heading), styles['h1']),
    Paragraph(esc(intro), styles['intro']),
]
frame_width = letter[0] - 1.5 * inch
for name, items in sections:
    cell = [Paragraph(esc(name), styles['h2'])] + [Paragraph(esc(item), styles['li'], bulletText='•') for item in items]
    box = Table([[cell]], colWidths=[frame_width])
    box.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), PANEL),
        ('BOX', (0, 0), (-1, -1), 0.75, BORDER),
        ('ROUNDEDCORNERS', [10, 10, 10, 10]),
        ('LEFTPADDING', (0, 0), (-1, -1), 16),
        ('RIGHTPADDING', (0, 0), (-1, -1), 16),
        ('TOPPADDING', (0, 0), (-1, -1), 12),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 12),
    ]))
    story += [Spacer(1, 12), KeepTogether(box)]
story.append(Paragraph(esc(footer), styles['footer']))


def page_footer(canvas, doc):
    canvas.saveState()
    canvas.setFont('Helvetica', 8.5)
    canvas.setFillColor(FOOT)
    canvas.drawString(0.75 * inch, 0.5 * inch, 'Mesa Wren Landscape Co. planning checklist')
    canvas.drawRightString(letter[0] - 0.75 * inch, 0.5 * inch, 'Page %d' % doc.page)
    canvas.restoreState()


doc = SimpleDocTemplate(
    OUT, pagesize=letter, title=title, author='Mesa Wren Landscape Co.', subject=heading, creator='Mesa Wren Landscape Co.',
    leftMargin=0.75 * inch, rightMargin=0.75 * inch, topMargin=0.75 * inch, bottomMargin=0.85 * inch,
)
doc.build(story, onFirstPage=page_footer, onLaterPages=page_footer)
print('Wrote', os.path.relpath(OUT, ROOT))
