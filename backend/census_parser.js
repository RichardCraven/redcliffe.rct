/**
 * Census Data Parsers & Extensible Carrier Registry
 * Handles CanadaLife (3 TXT files), ManuLife (65-col Excel), GroupSource (56-col CSV)
 */

const { parse } = require('csv-parse');
const XLSX = require('xlsx');
const {
  CANADALIFE_EMP_COLUMNS,
  CANADALIFE_BFT_COLUMNS,
  CANADALIFE_BNC_COLUMNS,
  MANULIFE_EXCEL_COLUMNS,
  MANULIFE_BENEFITS,
  GROUPSOURCE_BENEFIT_KEYS,
  BENEFIT_LABELS,
  RELATIONSHIP_LABELS,
  CARRIER_SPECIFICATIONS
} = require('./census_models');

/**
 * Helper to parse CSV/TXT string into rows
 */
function parseDelimitedText(content) {
  return new Promise((resolve, reject) => {
    parse(content, {
      relax_quotes: true,
      relax_column_count: true,
      trim: true,
      skip_empty_lines: true
    }, (err, rows) => {
      if (err) return reject(err);
      resolve(rows);
    });
  });
}

/**
 * Format string helper (Title Case)
 */
function formatName(str) {
  if (!str) return '';
  return str.trim()
    .toLowerCase()
    .split(/\s+/)
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

/**
 * CanadaLife Parser
 * Parses ENROLLEMP.TXT, ENROLLBFT.TXT, and ENROLLBNC.TXT, then unifies them into CensusEmployee objects.
 */
async function parseCanadaLife(files) {
  let empRows = [];
  let bftRows = [];
  let bncRows = [];
  const filesProcessed = [];

  for (const file of files) {
    const filename = (file.originalname || file.name || '').toUpperCase();
    const content = file.buffer ? file.buffer.toString('utf-8') : file.content;
    if (!content) continue;

    const rows = await parseDelimitedText(content);
    if (!rows || rows.length === 0) continue;

    // Detect by filename or column count
    const colCount = rows[0] ? rows[0].length : 0;
    if (filename.includes('EMP') || colCount >= 38) {
      empRows = rows;
      filesProcessed.push(file.originalname || 'ENROLLEMP.TXT');
    } else if (filename.includes('BFT') || (colCount >= 18 && colCount <= 22)) {
      bftRows = rows;
      filesProcessed.push(file.originalname || 'ENROLLBFT.TXT');
    } else if (filename.includes('BNC') || (colCount >= 12 && colCount <= 16)) {
      bncRows = rows;
      filesProcessed.push(file.originalname || 'ENROLLBNC.TXT');
    } else {
      if (colCount >= 35) {
        empRows = rows;
        filesProcessed.push(file.originalname || 'ENROLLEMP.TXT');
      } else if (colCount >= 18) {
        bftRows = rows;
        filesProcessed.push(file.originalname || 'ENROLLBFT.TXT');
      } else {
        bncRows = rows;
        filesProcessed.push(file.originalname || 'ENROLLBNC.TXT');
      }
    }
  }

  const certMap = new Map();
  let policyNumber = '';

  // 1. Process Employees
  for (const r of empRows) {
    if (!r || r.length < 5) continue;
    const cert = String(r[CANADALIFE_EMP_COLUMNS.CERTIFICATE_NUMBER] || '').trim();
    if (!cert) continue;

    if (!policyNumber && r[CANADALIFE_EMP_COLUMNS.POLICY_NUMBER]) {
      policyNumber = String(r[CANADALIFE_EMP_COLUMNS.POLICY_NUMBER]).trim();
    }

    const lName = String(r[CANADALIFE_EMP_COLUMNS.LAST_NAME] || '').trim();
    const fName = String(r[CANADALIFE_EMP_COLUMNS.FIRST_NAME] || '').trim();
    const fullName = `${formatName(fName)} ${formatName(lName)}`.trim();
    const rawStatus = String(r[CANADALIFE_EMP_COLUMNS.ENROLLMENT_STATUS] || '').trim().toUpperCase();
    const isTerminated = rawStatus === 'TERMINATED' || !!r[CANADALIFE_EMP_COLUMNS.TERMINATION_DATE];

    const empObj = {
      policyNumber: String(r[CANADALIFE_EMP_COLUMNS.POLICY_NUMBER] || policyNumber).trim(),
      certificateNumber: cert,
      division: String(r[CANADALIFE_EMP_COLUMNS.DIVISION] || '').trim(),
      class: String(r[CANADALIFE_EMP_COLUMNS.CLASS_CODE] || '').trim(),
      subclass: String(r[CANADALIFE_EMP_COLUMNS.SUBCLASS_CODE] || '').trim(),
      lastName: formatName(lName),
      firstName: formatName(fName),
      fullName: fullName,
      status: isTerminated ? 'Terminated' : 'Active',
      memberType: String(r[CANADALIFE_EMP_COLUMNS.MEMBER_TYPE] || '').trim(),
      effectiveDate: String(r[CANADALIFE_EMP_COLUMNS.EFFECTIVE_DATE] || '').trim(),
      processDate: String(r[CANADALIFE_EMP_COLUMNS.PROCESS_DATE] || '').trim(),
      terminationDate: String(r[CANADALIFE_EMP_COLUMNS.TERMINATION_DATE] || '').trim(),
      birthDate: String(r[CANADALIFE_EMP_COLUMNS.BIRTH_DATE] || '').trim(),
      gender: String(r[CANADALIFE_EMP_COLUMNS.GENDER] || '').trim(),
      language: String(r[CANADALIFE_EMP_COLUMNS.LANGUAGE] || '').trim(),
      address: String(r[CANADALIFE_EMP_COLUMNS.ADDRESS] || '').trim(),
      city: String(r[CANADALIFE_EMP_COLUMNS.CITY] || '').trim(),
      province: String(r[CANADALIFE_EMP_COLUMNS.PROVINCE] || '').trim(),
      postalCode: String(r[CANADALIFE_EMP_COLUMNS.POSTAL_CODE] || '').trim(),
      phone: String(r[CANADALIFE_EMP_COLUMNS.PHONE] || '').trim(),
      hireDate: String(r[CANADALIFE_EMP_COLUMNS.HIRE_DATE] || '').trim(),
      employmentProvince: String(r[CANADALIFE_EMP_COLUMNS.EMPLOYMENT_PROVINCE] || '').trim(),
      residenceProvince: String(r[CANADALIFE_EMP_COLUMNS.RESIDENCE_PROVINCE] || '').trim(),
      smoker: String(r[CANADALIFE_EMP_COLUMNS.SMOKER_STATUS] || '').trim(),
      occupationCode: String(r[CANADALIFE_EMP_COLUMNS.OCCUPATION_CODE] || '').trim(),
      exempt: String(r[CANADALIFE_EMP_COLUMNS.EXEMPT_STATUS] || '').trim(),
      bankTransit: String(r[CANADALIFE_EMP_COLUMNS.BANK_TRANSIT] || '').trim(),
      bankInstitution: String(r[CANADALIFE_EMP_COLUMNS.BANK_INSTITUTION] || '').trim(),
      bankAccount: String(r[CANADALIFE_EMP_COLUMNS.BANK_ACCOUNT] || '').trim(),
      salary: parseFloat(r[CANADALIFE_EMP_COLUMNS.SALARY]) || 0,
      salaryMode: String(r[CANADALIFE_EMP_COLUMNS.SALARY_MODE] || 'A').trim(),
      carrier: 'CanadaLife',
      benefits: [],
      dependents: []
    };

    certMap.set(cert, empObj);
  }

  // 2. Process Benefits
  for (const r of bftRows) {
    if (!r || r.length < 5) continue;
    const cert = String(r[CANADALIFE_BFT_COLUMNS.CERTIFICATE_NUMBER] || '').trim();
    if (!cert) continue;

    const bCode = String(r[CANADALIFE_BFT_COLUMNS.BENEFIT_CODE] || '').trim();
    const benefitName = BENEFIT_LABELS[bCode] || bCode;
    const covAmount = parseFloat(r[CANADALIFE_BFT_COLUMNS.COVERAGE_AMOUNT]) || undefined;

    const benefitLine = {
      policyNumber: String(r[CANADALIFE_BFT_COLUMNS.POLICY_NUMBER] || policyNumber).trim(),
      certificateNumber: cert,
      benefitCode: bCode,
      benefitName: benefitName,
      status: String(r[CANADALIFE_BFT_COLUMNS.STATUS] || 'IN-FORCE').trim(),
      secondaryStatus: String(r[CANADALIFE_BFT_COLUMNS.SECONDARY_STATUS] || '').trim(),
      coverageType: String(r[CANADALIFE_BFT_COLUMNS.COVERAGE_TYPE] || '').trim(),
      coverageAmount: covAmount,
      effectiveDate: String(r[CANADALIFE_BFT_COLUMNS.EFFECTIVE_DATE] || '').trim(),
      processDate: String(r[CANADALIFE_BFT_COLUMNS.PROCESS_DATE] || '').trim(),
      eligible: String(r[CANADALIFE_BFT_COLUMNS.ELIGIBLE] || 'Y').trim(),
      salary: parseFloat(r[CANADALIFE_BFT_COLUMNS.SALARY]) || undefined,
      salaryMode: String(r[CANADALIFE_BFT_COLUMNS.SALARY_MODE] || '').trim()
    };

    if (certMap.has(cert)) {
      certMap.get(cert).benefits.push(benefitLine);
    } else {
      const lName = String(r[CANADALIFE_BFT_COLUMNS.LAST_NAME] || '').trim();
      const fName = String(r[CANADALIFE_BFT_COLUMNS.FIRST_NAME] || '').trim();
      certMap.set(cert, {
        policyNumber: benefitLine.policyNumber,
        certificateNumber: cert,
        lastName: formatName(lName),
        firstName: formatName(fName),
        fullName: `${formatName(fName)} ${formatName(lName)}`.trim(),
        status: 'Active',
        carrier: 'CanadaLife',
        benefits: [benefitLine],
        dependents: []
      });
    }
  }

  // 3. Process Dependents
  for (const r of bncRows) {
    if (!r || r.length < 5) continue;
    const cert = String(r[CANADALIFE_BNC_COLUMNS.CERTIFICATE_NUMBER] || '').trim();
    if (!cert) continue;

    const relCode = String(r[CANADALIFE_BNC_COLUMNS.RELATIONSHIP_CODE] || '').trim();
    const relName = RELATIONSHIP_LABELS[relCode] || relCode || 'Dependent';
    const depName = String(r[CANADALIFE_BNC_COLUMNS.DEPENDENT_NAME] || '').trim();

    const depLine = {
      policyNumber: String(r[CANADALIFE_BNC_COLUMNS.POLICY_NUMBER] || policyNumber).trim(),
      certificateNumber: cert,
      dependentName: formatName(depName),
      relationshipCode: relCode,
      relationship: relName,
      effectiveDate: String(r[CANADALIFE_BNC_COLUMNS.EFFECTIVE_DATE] || '').trim(),
      terminationDate: String(r[CANADALIFE_BNC_COLUMNS.TERMINATION_DATE] || '').trim(),
      covered: String(r[CANADALIFE_BNC_COLUMNS.COVERED] || 'Y').trim(),
      province: String(r[CANADALIFE_BNC_COLUMNS.PROVINCE] || '').trim()
    };

    if (certMap.has(cert)) {
      certMap.get(cert).dependents.push(depLine);
    }
  }

  const employees = Array.from(certMap.values());
  const totalBenefits = employees.reduce((acc, e) => acc + (e.benefits ? e.benefits.length : 0), 0);
  const totalDependents = employees.reduce((acc, e) => acc + (e.dependents ? e.dependents.length : 0), 0);

  return {
    carrier: 'CanadaLife',
    policyNumber: policyNumber || '335760',
    totalEmployees: employees.length,
    totalBenefits,
    totalDependents,
    filesProcessed,
    employees
  };
}

/**
 * ManuLife Excel Parser (65-Column Member Detail Billing Spreadsheet)
 * Parses files like eac47b85-44e9-4fd0-9b80-f0ed004ffa05.xlsx
 */
async function parseManuLifeExcel(files) {
  const filesProcessed = [];
  const employees = [];
  let totalBenefitsCount = 0;
  let totalDependentsCount = 0;
  let detectedPolicyOrClass = '';
  let detectedClientName = '';

  for (const file of files) {
    let wb = null;
    if (file.buffer) {
      wb = XLSX.read(file.buffer, { type: 'buffer' });
    } else if (file.path) {
      wb = XLSX.readFile(file.path);
    } else if (typeof file.content === 'string') {
      wb = XLSX.read(Buffer.from(file.content, 'base64'), { type: 'buffer' });
    }
    if (!wb || !wb.SheetNames || wb.SheetNames.length === 0) continue;

    filesProcessed.push(file.originalname || file.name || 'ManuLife_Census.xlsx');

    // Use sheet named with MemberDetail or the first sheet
    const targetSheetName = wb.SheetNames.find(s => s.toLowerCase().includes('memberdetail')) || wb.SheetNames[0];
    const sheet = wb.Sheets[targetSheetName];
    const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });

    if (!rows || rows.length < 2) continue;

    const headers = rows[0].map(h => String(h || '').trim());

    for (let rIdx = 1; rIdx < rows.length; rIdx++) {
      const r = rows[rIdx];
      if (!r || r.length < 5) continue;

      const certNum = String(r[MANULIFE_EXCEL_COLUMNS.CERTIFICATE_NUM] || '').trim();
      // Skip empty or non-numeric header/footer legend rows
      if (!certNum || isNaN(certNum)) continue;

      const lName = String(r[MANULIFE_EXCEL_COLUMNS.LAST_NAME] || '').trim();
      const fName = String(r[MANULIFE_EXCEL_COLUMNS.FIRST_NAME] || '').trim();
      if (!lName || !fName) continue;

      const className = String(r[MANULIFE_EXCEL_COLUMNS.CLASS_NAME] || '').trim();
      const classCode = String(r[MANULIFE_EXCEL_COLUMNS.CLASS_CODE] || '').trim();
      const planName = String(r[MANULIFE_EXCEL_COLUMNS.PLAN_NAME] || '').trim();
      const planCode = String(r[MANULIFE_EXCEL_COLUMNS.PLAN_CODE] || '').trim();
      const provWork = String(r[MANULIFE_EXCEL_COLUMNS.PROVINCE_WORK] || '').trim();
      const provRes = String(r[MANULIFE_EXCEL_COLUMNS.PROVINCE_RES] || '').trim();

      if (!detectedPolicyOrClass && classCode) {
        detectedPolicyOrClass = classCode;
      }

      // Extract client name e.g. "101 - Mulgrave Independent School Society" -> "Mulgrave School"
      let clientAccount = 'Mulgrave School';
      if (className.toLowerCase().includes('mulgrave')) {
        clientAccount = 'Mulgrave School';
      } else if (className) {
        clientAccount = className.replace(/^\d+\s*-\s*/, '').trim();
      }
      if (!detectedClientName && clientAccount) {
        detectedClientName = clientAccount;
      }

      const totalCurrentPremium = parseFloat(r[MANULIFE_EXCEL_COLUMNS.TOTAL_CURRENT_PREMIUM]) || 0;
      const totalPriorAdj = parseFloat(r[MANULIFE_EXCEL_COLUMNS.TOTAL_PRIOR_ADJUSTMENTS]) || 0;
      const totalSalesTax = parseFloat(r[MANULIFE_EXCEL_COLUMNS.TOTAL_SALES_TAX]) || 0;
      const totalPremTax = parseFloat(r[MANULIFE_EXCEL_COLUMNS.TOTAL_PREMIUM_AND_TAX]) || totalCurrentPremium;

      const benefits = [];
      const dependents = [];

      // Parse the 7 Benefits (ELI, DLI, ADD, EHC, DEN, STD, LTD)
      for (const b of MANULIFE_BENEFITS) {
        const pCode = String(r[b.startCol] || '').trim();
        const volOrTier = r[b.startCol + 1];
        const opt = String(r[b.startCol + 2] || '').trim();
        const currPrem = parseFloat(r[b.startCol + 3]) || 0;
        const priorAdj = parseFloat(r[b.startCol + 4]) || 0;
        const tax = parseFloat(r[b.startCol + 5]) || 0;
        const bTotal = parseFloat(r[b.startCol + 6]) || 0;

        const hasCoverage = pCode || volOrTier !== '' || currPrem > 0 || bTotal > 0;
        if (!hasCoverage) continue;

        let coverageTier = 'SINGLE';
        let covAmount = undefined;

        if (typeof volOrTier === 'string') {
          const vUpper = volOrTier.toUpperCase();
          if (vUpper.includes('FAMILY')) coverageTier = 'FAMILY';
          else if (vUpper.includes('COUPLE')) coverageTier = 'COUPLE';
          else if (vUpper.includes('SINGLE')) coverageTier = 'SINGLE';
          else if (!isNaN(volOrTier) && volOrTier !== '') {
            covAmount = parseFloat(volOrTier);
          }
        } else if (typeof volOrTier === 'number') {
          covAmount = volOrTier;
        }

        benefits.push({
          policyNumber: classCode || detectedPolicyOrClass || '101',
          certificateNumber: certNum,
          benefitCode: b.code,
          benefitName: b.name,
          status: 'IN-FORCE',
          coverageType: coverageTier,
          coverageAmount: covAmount,
          monthlyPremium: currPrem > 0 ? currPrem : bTotal,
          eligible: 'Y'
        });
        totalBenefitsCount++;

        // Add dependent entry if Family tier
        if (coverageTier === 'FAMILY' && !dependents.some(d => d.relationshipCode === 'FAM')) {
          dependents.push({
            policyNumber: classCode || detectedPolicyOrClass || '101',
            certificateNumber: certNum,
            dependentName: `${formatName(fName)} Family Dependents`,
            relationshipCode: 'FAM',
            relationship: 'Family Dependents',
            covered: 'Y',
            province: provRes || provWork || 'BC'
          });
          totalDependentsCount++;
        }
      }

      // If DLI (Dependent Life) is active, ensure dependent line exists
      const dliActive = benefits.find(b => b.benefitCode === 'DEP_LIFE');
      if (dliActive && dependents.length === 0) {
        dependents.push({
          policyNumber: classCode || detectedPolicyOrClass || '101',
          certificateNumber: certNum,
          dependentName: `${formatName(fName)} Covered Dependents`,
          relationshipCode: 'SP',
          relationship: 'Spouse / Dependent',
          covered: 'Y',
          province: provRes || provWork || 'BC'
        });
        totalDependentsCount++;
      }

      // Build raw fields object for full inspection
      const rawFields = {};
      headers.forEach((h, cIdx) => {
        rawFields[h] = r[cIdx] !== undefined ? r[cIdx] : null;
      });

      employees.push({
        policyNumber: classCode || '101',
        certificateNumber: certNum,
        division: classCode || '101',
        class: className || 'Mulgrave Independent School Society',
        subclass: planCode || 'AA',
        lastName: formatName(lName),
        firstName: formatName(fName),
        fullName: `${formatName(fName)} ${formatName(lName)}`.trim(),
        status: 'Active',
        memberType: planName || 'Employee',
        employmentProvince: provWork,
        residenceProvince: provRes,
        province: provRes || provWork || 'BC',
        carrier: 'ManuLife',
        accountName: clientAccount,
        totalMonthlyPremium: totalPremTax,
        totalEmployeeCost: 0,
        totalEmployerCost: totalPremTax,
        benefits,
        dependents,
        rawFields
      });
    }
  }

  return {
    carrier: 'ManuLife',
    policyNumber: detectedPolicyOrClass || '101',
    matchedAccountName: detectedClientName || 'Mulgrave School',
    totalEmployees: employees.length,
    totalBenefits: totalBenefitsCount,
    totalDependents: totalDependentsCount,
    filesProcessed,
    employees
  };
}

/**
 * GroupSource Parser
 * Parses 56-column consolidated billing premium CSV file
 */
async function parseGroupSource(files) {
  const filesProcessed = [];
  const employees = [];
  let totalBenefitsCount = 0;
  let ledgerId = '';

  for (const file of files) {
    const content = file.buffer ? file.buffer.toString('utf-8') : file.content;
    if (!content) continue;

    filesProcessed.push(file.originalname || file.name || 'GroupSource_BillingPremium.csv');

    const rows = await new Promise((resolve, reject) => {
      parse(content, {
        columns: true,
        relax_quotes: true,
        relax_column_count: true,
        trim: true,
        skip_empty_lines: true
      }, (err, records) => {
        if (err) return reject(err);
        resolve(records);
      });
    });

    if (!rows || rows.length === 0) continue;

    for (const r of rows) {
      if (!ledgerId && r.Ledger) {
        ledgerId = String(r.Ledger).trim();
      }

      const pin = String(r.PIN || '').trim();
      if (!pin) continue;

      const lName = String(r.LastName || '').trim();
      const fName = String(r.FirstName || '').trim();
      const fullName = `${formatName(fName)} ${formatName(lName)}`.trim();

      const benefits = [];
      const dependents = [];

      for (const b of GROUPSOURCE_BENEFIT_KEYS) {
        const total = parseFloat(r[b.totalCol]) || 0;
        const volume = r[b.volumeCol];
        const effDate = r[b.effDateCol];

        if (total > 0 || (volume && volume !== '0' && volume !== 'N')) {
          let coverageType = 'SINGLE';
          let covAmount = undefined;

          if (volume === 'F') coverageType = 'FAMILY';
          else if (volume === 'C') coverageType = 'COUPLE';
          else if (volume === 'S') coverageType = 'SINGLE';
          else if (typeof volume === 'string' && volume.includes(',')) {
            covAmount = parseFloat(volume.replace(/,/g, '')) || undefined;
          } else if (!isNaN(volume) && volume !== '') {
            covAmount = parseFloat(volume) || undefined;
          }

          benefits.push({
            policyNumber: ledgerId || 'GroupSource',
            certificateNumber: pin,
            benefitCode: b.code,
            benefitName: b.name,
            status: 'IN-FORCE',
            coverageType: coverageType,
            coverageAmount: covAmount,
            monthlyPremium: total,
            effectiveDate: effDate || r.OverallEffectiveDate || ''
          });
          totalBenefitsCount++;
        }
      }

      if (r.EmployeeFamilyStatus === 'F') {
        dependents.push({
          policyNumber: ledgerId || 'GroupSource',
          certificateNumber: pin,
          dependentName: `${formatName(fName)} Family Dependents`,
          relationshipCode: 'FAM',
          relationship: 'Family Dependents',
          covered: 'Y'
        });
      }

      const cleanSalary = parseFloat(String(r.AnnualEarnings || '0').replace(/,/g, '')) || 0;

      employees.push({
        policyNumber: ledgerId || 'GroupSource',
        certificateNumber: pin,
        employeeNumber: String(r.EmployeeNumber || '').trim(),
        costCode: String(r.CostCode || '').trim(),
        division: String(r.CostCode || '001').trim(),
        class: String(r.Class || '').trim(),
        subclass: String(r.ReportClass || '').trim(),
        lastName: formatName(lName),
        firstName: formatName(fName),
        fullName: fullName,
        status: r.Status || 'Active',
        memberType: r.Occupation || 'Employee',
        effectiveDate: r.OverallEffectiveDate || '',
        hireDate: r.EmploymentDate || '',
        birthDate: r.EmployeeBirthDate || '',
        gender: r.Gender || '',
        address: r.EmployeeAddress || '',
        city: r.EmployeeCity || '',
        province: r.EmployeeProvince || '',
        phone: '',
        email: r.Email || '',
        personalEmail: r.PersonalEmail || '',
        salary: cleanSalary,
        salaryMode: 'A',
        carrier: 'GroupSource',
        totalEmployeeCost: parseFloat(r.Total_EE) || 0,
        totalEmployerCost: parseFloat(r.Total_ER) || 0,
        totalMonthlyPremium: parseFloat(r.Total) || 0,
        benefits: benefits,
        dependents: dependents,
        rawFields: r
      });
    }
  }

  return {
    carrier: 'GroupSource',
    policyNumber: ledgerId,
    totalEmployees: employees.length,
    totalBenefits: totalBenefitsCount,
    totalDependents: employees.reduce((acc, e) => acc + e.dependents.length, 0),
    filesProcessed,
    employees
  };
}

/**
 * Extensible Carrier Registry
 */
const carrierParsers = new Map();

// Register built-in carriers
carrierParsers.set('canadalife', parseCanadaLife);
carrierParsers.set('manulife', parseManuLifeExcel);
carrierParsers.set('groupsource', parseGroupSource);

/**
 * Register a new carrier parser dynamically
 */
function registerCarrierParser(carrierKey, parserFn) {
  carrierParsers.set(carrierKey.toLowerCase().replace(/\s+/g, ''), parserFn);
}

/**
 * Universal Carrier Parser Router
 */
async function parseCarrierCensus(files, requestedCarrier = 'CanadaLife') {
  if (!files || files.length === 0) {
    throw new Error('No census files provided for parsing.');
  }

  let carrierKey = requestedCarrier.toLowerCase().replace(/\s+/g, '');

  const firstFilename = (files[0].originalname || files[0].name || '').toUpperCase();
  const isExcel = firstFilename.endsWith('.XLSX') || firstFilename.endsWith('.XLS') || (files[0].buffer && files[0].buffer.slice(0, 4).toString('hex') === '504b0304');

  // Auto-detect based on file patterns and content
  if (isExcel || firstFilename.includes('MANULIFE')) {
    carrierKey = 'manulife';
  } else if (firstFilename.includes('GROUPSOURCE') || firstFilename.includes('BILLINGPREMIUM')) {
    carrierKey = 'groupsource';
  } else if (firstFilename.includes('ENROLL') || firstFilename.includes('CANADALIFE') || firstFilename.endsWith('.TXT')) {
    carrierKey = 'canadalife';
  }

  const parser = carrierParsers.get(carrierKey) || (isExcel ? parseManuLifeExcel : parseCanadaLife);
  return await parser(files);
}

module.exports = {
  parseDelimitedText,
  parseCanadaLife,
  parseManuLifeExcel,
  parseManuLife: parseManuLifeExcel, // alias
  parseGroupSource,
  parseCarrierCensus,
  registerCarrierParser,
  CARRIER_SPECIFICATIONS
};
