import * as XLSX from 'xlsx-js-style';

/**
 * 데이터를 엑셀 파일로 내보내기
 * @param data - 엑셀로 내보낼 데이터 배열
 * @param fileName - 저장할 파일명 (확장자 제외)
 * @param sheetName - 시트 이름 (기본값: 'Sheet1')
 */
export const exportToExcel = <T extends Record<string, any>>(
  data: T[],
  fileName: string,
  sheetName: string = 'Sheet1'
) => {
  if (data.length === 0) {
    alert('내보낼 데이터가 없습니다.');
    return;
  }

  // 워크북 생성
  const worksheet = XLSX.utils.json_to_sheet(data);
  const workbook = XLSX.utils.book_new();

  // 스타일 적용
  applyStyles(worksheet, Object.keys(data[0]).length, data.length);

  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);

  // 컬럼 너비 자동 조정
  const maxWidth = 50;
  const columnWidths = Object.keys(data[0]).map((key) => {
    const maxLength = Math.max(
      key.length,
      ...data.map((row) => String(row[key] || '').length)
    );
    return { wch: Math.min(maxLength + 2, maxWidth) };
  });
  worksheet['!cols'] = columnWidths;

  // 파일 다운로드
  const timestamp = new Date().toISOString().split('T')[0];
  XLSX.writeFile(workbook, `${fileName}_${timestamp}.xlsx`);
};

/**
 * 커스텀 헤더로 엑셀 내보내기 (테두리 및 헤더 색상 포함)
 * @param data - 엑셀로 내보낼 데이터 배열
 * @param headers - { key: '표시할 헤더명' } 형식의 객체
 * @param fileName - 저장할 파일명 (확장자 제외)
 * @param sheetName - 시트 이름 (기본값: 'Sheet1')
 */
export const exportToExcelWithHeaders = <T extends Record<string, any>>(
  data: T[],
  headers: Record<keyof T, string>,
  fileName: string,
  sheetName: string = 'Sheet1',
  fixedColWidths?: number[]
) => {
  if (data.length === 0) {
    alert('내보낼 데이터가 없습니다.');
    return;
  }

  // 헤더 순서대로 데이터 변환
  const transformedData = data.map((row) => {
    const newRow: Record<string, any> = {};
    Object.keys(headers).forEach((key) => {
      newRow[headers[key as keyof T]] = row[key];
    });
    return newRow;
  });

  // 워크북 생성
  const worksheet = XLSX.utils.json_to_sheet(transformedData);
  const workbook = XLSX.utils.book_new();

  // 스타일 적용
  applyStyles(worksheet, Object.keys(headers).length, data.length);

  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);

  // 컬럼 너비: 고정값 우선, 없으면 자동 계산
  if (fixedColWidths) {
    worksheet['!cols'] = fixedColWidths.map((w) => ({ wch: w }));
  } else {
    const maxWidth = 50;
    const columnWidths = Object.values(headers).map((header) => {
      const maxLength = Math.max(
        String(header).length,
        ...transformedData.map((row) => String(row[header] || '').length)
      );
      return { wch: Math.min(maxLength + 2, maxWidth) };
    });
    worksheet['!cols'] = columnWidths;
  }

  // 파일 다운로드
  const timestamp = new Date().toISOString().split('T')[0];
  XLSX.writeFile(workbook, `${fileName}_${timestamp}.xlsx`);
};

/**
 * 워크시트에 스타일 적용 (헤더 색상, 테두리, 행 높이)
 */
const applyStyles = (worksheet: XLSX.WorkSheet, colCount: number, rowCount: number) => {
  const range = XLSX.utils.decode_range(worksheet['!ref'] || 'A1');

  // 테두리 스타일 - 화면 리스트와 유사하게 얇은 회색
  const borderStyle = {
    top:    { style: 'thin', color: { rgb: 'D0D0D0' } },
    bottom: { style: 'thin', color: { rgb: 'D0D0D0' } },
    left:   { style: 'thin', color: { rgb: 'D0D0D0' } },
    right:  { style: 'thin', color: { rgb: 'D0D0D0' } },
  };
  const headerBorder = {
    top:    { style: 'thin', color: { rgb: 'B0B0B0' } },
    bottom: { style: 'medium', color: { rgb: '808080' } },
    left:   { style: 'thin', color: { rgb: 'B0B0B0' } },
    right:  { style: 'thin', color: { rgb: 'B0B0B0' } },
  };

  // 헤더 스타일 (첫 번째 행) - 화면 헤더 색상과 유사한 F7F6F3
  for (let C = range.s.c; C <= range.e.c; ++C) {
    const headerCell = XLSX.utils.encode_cell({ r: 0, c: C });
    if (!worksheet[headerCell]) continue;

    worksheet[headerCell].s = {
      fill: {
        patternType: 'solid',
        fgColor: { rgb: 'F0EFED' }, // 화면 헤더 배경색과 유사
      },
      font: {
        bold: true,
        color: { rgb: '555555' },
        sz: 10,
        name: '맑은 고딕',
      },
      alignment: {
        horizontal: 'center',
        vertical: 'center',
      },
      border: headerBorder,
    };
  }

  // 데이터 셀 스타일
  for (let R = 1; R <= range.e.r; ++R) {
    const isEven = R % 2 === 0;
    for (let C = range.s.c; C <= range.e.c; ++C) {
      const cellAddress = XLSX.utils.encode_cell({ r: R, c: C });
      if (!worksheet[cellAddress]) {
        worksheet[cellAddress] = { t: 's', v: '' };
      }
      worksheet[cellAddress].s = {
        fill: isEven
          ? { patternType: 'solid', fgColor: { rgb: 'F9F9F8' } }
          : { patternType: 'none' },
        border: borderStyle,
        font: {
          sz: 10,
          name: '맑은 고딕',
          color: { rgb: '333333' },
        },
        alignment: {
          vertical: 'center',
          wrapText: false,
        },
      };
    }
  }

  // 행 높이 설정
  const rowHeights: { hpx: number }[] = [];
  rowHeights[0] = { hpx: 28 }; // 헤더 행
  for (let R = 1; R <= range.e.r; ++R) {
    rowHeights[R] = { hpx: 22 }; // 데이터 행
  }
  worksheet['!rows'] = rowHeights;
};

/**
 * 여러 시트를 가진 엑셀 파일 내보내기
 * @param sheets - { sheetName: data[] } 형식의 객체
 * @param fileName - 저장할 파일명 (확장자 제외)
 */
export const exportMultipleSheets = (
  sheets: Record<string, any[]>,
  fileName: string
) => {
  const workbook = XLSX.utils.book_new();

  Object.entries(sheets).forEach(([sheetName, data]) => {
    if (data.length > 0) {
      const worksheet = XLSX.utils.json_to_sheet(data);

      // 스타일 적용
      applyStyles(worksheet, Object.keys(data[0]).length, data.length);

      // 컬럼 너비 자동 조정
      const maxWidth = 50;
      const columnWidths = Object.keys(data[0]).map((key) => {
        const maxLength = Math.max(
          key.length,
          ...data.map((row) => String(row[key] || '').length)
        );
        return { wch: Math.min(maxLength + 2, maxWidth) };
      });
      worksheet['!cols'] = columnWidths;

      XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
    }
  });

  // 파일 다운로드
  const timestamp = new Date().toISOString().split('T')[0];
  XLSX.writeFile(workbook, `${fileName}_${timestamp}.xlsx`);
};
