/**
 * Census Data Models and Carrier Specifications
 * Backend Reference and Format Definitions
 */

// CanadaLife: 40-Column Employee Master
const CANADALIFE_EMP_COLUMNS = {
  POLICY_NUMBER: 0,
  DIVISION_SUB: 1,
  CERTIFICATE_NUMBER: 2,
  LAST_NAME: 3,
  FIRST_NAME: 4,
  MEMBER_TYPE: 5,
  EFFECTIVE_DATE: 6,
  PROCESS_DATE: 7,
  DIVISION: 8,
  CLASS_CODE: 9,
  SUBCLASS_CODE: 10,
  COL_11: 11,
  TERMINATION_DATE: 12,
  COL_13: 13,
  BIRTH_DATE: 14,
  GENDER: 15,
  LANGUAGE: 16,
  ADDRESS: 17,
  CITY: 18,
  PROVINCE: 19,
  POSTAL_CODE: 20,
  PHONE: 21,
  HIRE_DATE: 22,
  EMPLOYMENT_PROVINCE: 23,
  RESIDENCE_PROVINCE: 24,
  SMOKER_STATUS: 25,
  COL_26: 26,
  OCCUPATION_CODE: 27,
  EXEMPT_STATUS: 28,
  MARITAL_ELIGIBILITY: 29,
  COL_30: 30,
  COL_31: 31,
  BANK_TRANSIT: 32,
  BANK_INSTITUTION: 33,
  BANK_ACCOUNT: 34,
  SALARY: 35,
  SALARY_MODE: 36,
  COL_37: 37,
  ENROLLMENT_STATUS: 38,
  ADMIN_ID: 39
};

// CanadaLife: 20-Column Benefit Coverage Lines
const CANADALIFE_BFT_COLUMNS = {
  POLICY_NUMBER: 0,
  COL_1: 1,
  CERTIFICATE_NUMBER: 2,
  LAST_NAME: 3,
  FIRST_NAME: 4,
  MEMBER_TYPE: 5,
  EFFECTIVE_DATE: 6,
  PROCESS_DATE: 7,
  DIVISION: 8,
  CLASS_CODE: 9,
  BENEFIT_CODE: 10,
  SUBCODE: 11,
  STATUS: 12,
  SECONDARY_STATUS: 13,
  COVERAGE_TYPE: 14,
  COVERAGE_AMOUNT: 15,
  LATE_APPLICANT: 16,
  ELIGIBLE: 17,
  SALARY: 18,
  SALARY_MODE: 19
};

// CanadaLife: 14-Column Dependent / Beneficiary Registry
const CANADALIFE_BNC_COLUMNS = {
  POLICY_NUMBER: 0,
  COL_1: 1,
  CERTIFICATE_NUMBER: 2,
  LAST_NAME: 3,
  FIRST_NAME: 4,
  MEMBER_TYPE: 5,
  EFFECTIVE_DATE: 6,
  DIVISION: 7,
  CLASS_CODE: 8,
  TERMINATION_DATE: 9,
  DEPENDENT_NAME: 10,
  RELATIONSHIP_CODE: 11,
  COVERED: 12,
  PROVINCE: 13
};

// Backward-compatibility aliases
const MANULIFE_EMP_COLUMNS = CANADALIFE_EMP_COLUMNS;
const MANULIFE_BFT_COLUMNS = CANADALIFE_BFT_COLUMNS;
const MANULIFE_BNC_COLUMNS = CANADALIFE_BNC_COLUMNS;

/**
 * ManuLife Member Detail Excel Specification (65 Columns)
 * Sheet: 120124_MemberDetailCommaDel
 */
const MANULIFE_EXCEL_COLUMNS = {
  CERTIFICATE_NUM: 0,
  LAST_NAME: 1,
  FIRST_NAME: 2,
  CLASS_NAME: 3,
  CLASS_CODE: 4,
  PLAN_NAME: 5,
  PLAN_CODE: 6,
  PROVINCE_WORK: 7,
  PROVINCE_RES: 8,
  TOTAL_CURRENT_PREMIUM: 9,
  TOTAL_PRIOR_ADJUSTMENTS: 10,
  TOTAL_SALES_TAX: 11,
  TOTAL_PREMIUM_AND_TAX: 12,

  // 7 Benefits with 7 columns each:
  // [Plan Code, Dep Code or Volume, Option, Current Month Premium, Prior Period Adjustments, Total Sales Tax, Benefit Total]
  BENEFITS_START_COL: 13,
  COLS_PER_BENEFIT: 7
};

const MANULIFE_BENEFITS = [
  { prefix: 'ELI', code: 'BLIFE', name: 'Employee Life Insurance', startCol: 13 },
  { prefix: 'DLI', code: 'DEP_LIFE', name: 'Dependent Life Insurance', startCol: 20 },
  { prefix: 'ADD', code: 'AD&D', name: 'Accidental Death & Dismemberment', startCol: 27 },
  { prefix: 'EHC', code: 'HCARE', name: 'Extended Health Care', startCol: 34 },
  { prefix: 'DEN', code: 'DENT', name: 'Dental Benefits', startCol: 41 },
  { prefix: 'STD', code: 'STD', name: 'Short Term Disability', startCol: 48 },
  { prefix: 'LTD', code: 'LTD', name: 'Long Term Disability', startCol: 55 }
];

const BENEFIT_LABELS = {
  'AD&D': 'Accidental Death & Dismemberment',
  'BLIFE': 'Basic Life Insurance',
  'CNTCT': 'Critical Illness Coverage',
  'DENT': 'Dental Benefits',
  'HCARE': 'Extended Healthcare',
  'EHC': 'Extended Healthcare',
  'LTD': 'Long-Term Disability',
  'STD': 'Short-Term Disability',
  'DEP': 'Dependent Life',
  'DEP_LIFE': 'Dependent Life'
};

const RELATIONSHIP_LABELS = {
  'SP': 'Spouse',
  'DT': 'Daughter',
  'SN': 'Son',
  'CL': 'Common-Law',
  'PR': 'Parent',
  'OT': 'Other'
};

const GROUPSOURCE_BENEFIT_KEYS = [
  { key: 'LIFE', code: 'BLIFE', name: 'Basic Life Insurance', volumeCol: 'LIFE Level/Volume', totalCol: 'LIFE Total', effDateCol: 'LIFE EFF DATE' },
  { key: 'AD&D', code: 'AD&D', name: 'Accidental Death & Dismemberment', volumeCol: 'AD&D Level/Volume', totalCol: 'AD&D Total', effDateCol: 'AD&D EFF DATE' },
  { key: 'STD', code: 'STD', name: 'Short-Term Disability', volumeCol: 'STD Level/Volume', totalCol: 'STD Total', effDateCol: 'STD EFF DATE' },
  { key: 'LTD', code: 'LTD', name: 'Long-Term Disability', volumeCol: 'LTD Level/Volume', totalCol: 'LTD Total', effDateCol: 'LTD EFF DATE' },
  { key: 'DEP_LIFE', code: 'DEP_LIFE', name: 'Dependent Life', volumeCol: 'DEP_LIFE Level/Volume', totalCol: 'DEP_LIFE Total', effDateCol: 'DEP_LIFE EFF DATE' },
  { key: 'HEALTH', code: 'HCARE', name: 'Extended Healthcare', volumeCol: 'HEALTH Level/Volume', totalCol: 'HEALTH Total', effDateCol: 'HEALTH EFF DATE' },
  { key: 'DENTAL', code: 'DENT', name: 'Dental Benefits', volumeCol: 'DENTAL Level/Volume', totalCol: 'DENTAL Total', effDateCol: 'DENTAL EFF DATE' },
  { key: 'HSA', code: 'HSA', name: 'Health Spending Account', volumeCol: 'HSA Level/Volume', totalCol: 'HSA Total', effDateCol: 'HSA EFF DATE' },
  { key: 'EFAP', code: 'EFAP', name: 'Employee & Family Assistance', volumeCol: 'EFAP Level/Volume', totalCol: 'EFAP Total', effDateCol: 'EFAP EFF DATE' },
  { key: 'VIRTUAL_HEALTH', code: 'VIRTUAL_HEALTH', name: 'Virtual Healthcare', volumeCol: 'VIRTUAL_HEALTH Level/Volume', totalCol: 'VIRTUAL_HEALTH Total', effDateCol: 'VIRTUAL_HEALTH EFF DATE' }
];

const CARRIER_SPECIFICATIONS = [
  {
    carrierId: 'CanadaLife',
    carrierName: 'Canada Life',
    expectedFiles: ['ENROLLEMP.TXT', 'ENROLLBFT.TXT', 'ENROLLBNC.TXT'],
    description: 'Canada Life group enrollment files: 40-col employee master, 20-col benefit coverages, and 14-col dependent registry.',
    fileFormat: 'Comma-delimited TXT'
  },
  {
    carrierId: 'ManuLife',
    carrierName: 'ManuLife Financial',
    expectedFiles: ['*.xlsx', '*.xls', 'eac47b85-*.xlsx'],
    description: 'ManuLife Member Detail Billing Census: 65-column Excel spreadsheet detailing employee demographics, monthly premiums, and ELI, DLI, ADD, EHC, DEN, STD, LTD benefit breakdowns.',
    fileFormat: 'Excel Spreadsheet (.xlsx)'
  },
  {
    carrierId: 'GroupSource',
    carrierName: 'GroupSource TPA',
    expectedFiles: ['BillingPremium*.csv', 'tmp_BillingPremium_*.csv'],
    description: 'TPA 56-col consolidated billing census: demographics, 10 benefit coverages, and EE/ER premium splits.',
    fileFormat: 'CSV'
  },
  {
    carrierId: 'Generic',
    carrierName: 'Generic Census',
    expectedFiles: ['*.csv', '*.txt'],
    description: 'Standard employee census with columns for name, certificate, and coverage tier.',
    fileFormat: 'CSV or Delimited TXT'
  }
];

module.exports = {
  CANADALIFE_EMP_COLUMNS,
  CANADALIFE_BFT_COLUMNS,
  CANADALIFE_BNC_COLUMNS,
  MANULIFE_EMP_COLUMNS,
  MANULIFE_BFT_COLUMNS,
  MANULIFE_BNC_COLUMNS,
  MANULIFE_EXCEL_COLUMNS,
  MANULIFE_BENEFITS,
  GROUPSOURCE_BENEFIT_KEYS,
  BENEFIT_LABELS,
  RELATIONSHIP_LABELS,
  CARRIER_SPECIFICATIONS
};
