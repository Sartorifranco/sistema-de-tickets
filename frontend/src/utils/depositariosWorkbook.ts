export interface DepositarioExcelRow {
    alias?: string | null;
    serial_number?: string | null;
    address?: string | null;
    company_name?: string | null;
    owner?: string | null;
    commercial_action?: string | null;
    installed_on?: string | null;
    install_date_source?: string | null;
}

function commercialLabel(value?: string | null): string {
    const key = String(value || '').trim().toUpperCase();
    if (key === 'COMPRADO') return 'Comprado';
    if (key === 'ALQUILADO') return 'Alquilado';
    if (key === 'VENDIDO') return 'Vendido';
    return '';
}

function installCells(value?: string | null, source?: string | null): [string, string] {
    const raw = String(value || '').slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return ['', ''];
    const [year, month, day] = raw.split('-');
    if (source === 'numero_de_serie') return [`${month}/${year}`, 'Estimada por el número de serie'];
    return [`${day}/${month}/${year}`, 'Cargada a mano'];
}

const CRC_TABLE = (() => {
    const table = new Uint32Array(256);
    for (let n = 0; n < 256; n += 1) {
        let crc = n;
        for (let k = 0; k < 8; k += 1) {
            crc = (crc & 1) ? (0xedb88320 ^ (crc >>> 1)) : (crc >>> 1);
        }
        table[n] = crc >>> 0;
    }
    return table;
})();

function crc32(data: Uint8Array): number {
    let crc = 0xffffffff;
    for (let i = 0; i < data.length; i += 1) {
        crc = CRC_TABLE[(crc ^ data[i]) & 0xff] ^ (crc >>> 8);
    }
    return (crc ^ 0xffffffff) >>> 0;
}

function u16(value: number): Uint8Array {
    return Uint8Array.of(value & 0xff, (value >> 8) & 0xff);
}

function u32(value: number): Uint8Array {
    return Uint8Array.of(value & 0xff, (value >> 8) & 0xff, (value >> 16) & 0xff, (value >> 24) & 0xff);
}

function concat(parts: Uint8Array[]): Uint8Array {
    const length = parts.reduce((total, part) => total + part.length, 0);
    const out = new Uint8Array(length);
    let offset = 0;
    parts.forEach((part) => {
        out.set(part, offset);
        offset += part.length;
    });
    return out;
}

function xmlText(value: string): string {
    return value
        .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}

function textCell(ref: string, value: string, style: number): string {
    return `<c r="${ref}" s="${style}" t="inlineStr"><is><t xml:space="preserve">${xmlText(value)}</t></is></c>`;
}

function buildSheet(rows: DepositarioExcelRow[]): string {
    const instruction = 'Listado de equipos activos. La fecha marcada como estimada sale del mes y año codificados en el número de serie (por ejemplo 1023 = octubre 2023). No es un acta de instalación.';
    const headers = ['Nombre', 'Número de serie', 'Dirección', 'Cliente', 'Propietario', 'Condición', 'Fecha de instalación', 'Origen de la fecha'];
    const sorted = [...rows].sort((a, b) => {
        const byCompany = String(a.company_name || '').localeCompare(String(b.company_name || ''), 'es');
        if (byCompany !== 0) return byCompany;
        return String(a.alias || '').localeCompare(String(b.alias || ''), 'es');
    });

    const headerRow = headers
        .map((header, index) => textCell(`${String.fromCharCode(65 + index)}2`, header, 1))
        .join('');

    const dataRows = sorted.map((row, index) => {
        const excelRow = index + 3;
        const [installDate, installOrigin] = installCells(row.installed_on, row.install_date_source);
        const values = [
            String(row.alias || ''),
            String(row.serial_number || ''),
            String(row.address || ''),
            String(row.company_name || ''),
            String(row.owner || ''),
            commercialLabel(row.commercial_action),
            installDate,
            installOrigin,
        ];
        const cells = values.map((value, column) => textCell(`${String.fromCharCode(65 + column)}${excelRow}`, value, 0)).join('');
        return `<row r="${excelRow}" ht="18" customHeight="1">${cells}</row>`;
    }).join('');

    const lastRow = Math.max(2, sorted.length + 2);
    const lastColumn = String.fromCharCode(64 + headers.length);

    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <dimension ref="A1:${lastColumn}${lastRow}"/>
  <sheetViews>
    <sheetView workbookViewId="0">
      <pane ySplit="2" topLeftCell="A3" activePane="bottomLeft" state="frozen"/>
    </sheetView>
  </sheetViews>
  <cols>
    <col min="1" max="1" width="32" customWidth="1"/>
    <col min="2" max="2" width="22" customWidth="1"/>
    <col min="3" max="3" width="52" customWidth="1"/>
    <col min="4" max="4" width="28" customWidth="1"/>
    <col min="5" max="5" width="18" customWidth="1"/>
    <col min="6" max="6" width="16" customWidth="1"/>
    <col min="7" max="7" width="24" customWidth="1"/>
    <col min="8" max="8" width="32" customWidth="1"/>
  </cols>
  <sheetData>
    <row r="1" ht="36" customHeight="1">${textCell('A1', instruction, 3)}</row>
    <row r="2" ht="20" customHeight="1">${headerRow}</row>
    ${dataRows}
  </sheetData>
  <mergeCells count="1"><mergeCell ref="A1:${lastColumn}1"/></mergeCells>
</worksheet>`;
}

const STYLES_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <fonts count="3">
    <font><sz val="11"/><name val="Arial"/></font>
    <font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Arial"/></font>
    <font><i/><sz val="11"/><color rgb="FF1F2937"/><name val="Arial"/></font>
  </fonts>
  <fills count="5">
    <fill><patternFill patternType="none"/></fill>
    <fill><patternFill patternType="gray125"/></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FF1E3A5F"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FFFFF3C4"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FFEFF6FF"/></patternFill></fill>
  </fills>
  <borders count="2">
    <border><left/><right/><top/><bottom/><diagonal/></border>
    <border>
      <left style="thin"><color rgb="FFD1D5DB"/></left>
      <right style="thin"><color rgb="FFD1D5DB"/></right>
      <top style="thin"><color rgb="FFD1D5DB"/></top>
      <bottom style="thin"><color rgb="FFD1D5DB"/></bottom>
      <diagonal/>
    </border>
  </borders>
  <cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
  <cellXfs count="4">
    <xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyFont="1" applyBorder="1" applyAlignment="1"><alignment vertical="center" wrapText="1"/></xf>
    <xf numFmtId="0" fontId="1" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment vertical="center"/></xf>
    <xf numFmtId="0" fontId="0" fillId="3" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment vertical="center"/></xf>
    <xf numFmtId="0" fontId="2" fillId="4" borderId="0" xfId="0" applyFont="1" applyFill="1" applyAlignment="1"><alignment vertical="center" wrapText="1"/></xf>
  </cellXfs>
  <cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>
</styleSheet>`;

function workbookFiles(rows: DepositarioExcelRow[]): Array<[string, string]> {
    return [
        ['[Content_Types].xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  <Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
  <Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
</Types>`],
        ['_rels/.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`],
        ['xl/workbook.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheets><sheet name="Depositarios" sheetId="1" r:id="rId1"/></sheets>
</workbook>`],
        ['xl/_rels/workbook.xml.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`],
        ['xl/styles.xml', STYLES_XML],
        ['xl/worksheets/sheet1.xml', buildSheet(rows)],
    ];
}

export function buildDepositariosWorkbook(rows: DepositarioExcelRow[]): Uint8Array {
    const now = new Date();
    const dosTime = ((now.getHours() & 0x1f) << 11) | ((now.getMinutes() & 0x3f) << 5) | (Math.floor(now.getSeconds() / 2) & 0x1f);
    const dosDate = (((now.getFullYear() - 1980) & 0x7f) << 9) | (((now.getMonth() + 1) & 0x0f) << 5) | (now.getDate() & 0x1f);
    const encoder = new TextEncoder();
    const files = workbookFiles(rows).map(([name, contents]) => ({
        name: encoder.encode(name),
        data: encoder.encode(contents),
    }));

    const localParts: Uint8Array[] = [];
    const centralParts: Uint8Array[] = [];
    let offset = 0;

    files.forEach((file) => {
        const checksum = crc32(file.data);
        const local = concat([
            u32(0x04034b50),
            u16(20),
            u16(0),
            u16(0),
            u16(dosTime),
            u16(dosDate),
            u32(checksum),
            u32(file.data.length),
            u32(file.data.length),
            u16(file.name.length),
            u16(0),
            file.name,
            file.data,
        ]);
        localParts.push(local);
        centralParts.push(concat([
            u32(0x02014b50),
            u16(20),
            u16(20),
            u16(0),
            u16(0),
            u16(dosTime),
            u16(dosDate),
            u32(checksum),
            u32(file.data.length),
            u32(file.data.length),
            u16(file.name.length),
            u16(0),
            u16(0),
            u16(0),
            u16(0),
            u32(0),
            u32(offset),
            file.name,
        ]));
        offset += local.length;
    });

    const central = concat(centralParts);
    const end = concat([
        u32(0x06054b50),
        u16(0),
        u16(0),
        u16(files.length),
        u16(files.length),
        u32(central.length),
        u32(offset),
        u16(0),
    ]);

    return concat([...localParts, central, end]);
}

export function downloadDepositariosWorkbook(rows: DepositarioExcelRow[]): void {
    const bytes = buildDepositariosWorkbook(rows);
    const copy = new Uint8Array(bytes.byteLength);
    copy.set(bytes);
    const blob = new Blob([copy.buffer], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'depositarios.xlsx';
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
}
