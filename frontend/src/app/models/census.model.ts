/**
 * Census Data Models and Carrier Specifications
 * Redcliffe CRM Data Portal
 */

export type SupportedCarrier = 'ManuLife' | 'GroupSource' | 'CanadaLife' | 'SunLife' | 'Other';

/**
 * Universal Census Employee (Normalized across all carriers)
 */
export interface CensusEmployee {
  policyNumber: string;
  certificateNumber: string;
  division?: string;
  class?: string;
  subclass?: string;
  lastName: string;
  firstName: string;
  fullName: string;
  status: 'Active' | 'Terminated' | string;
  memberType?: string;
  effectiveDate?: string;
  processDate?: string;
  terminationDate?: string;
  birthDate?: string;
  gender?: 'M' | 'F' | string;
  language?: 'E' | 'F' | string;
  address?: string;
  city?: string;
  province?: string;
  postalCode?: string;
  phone?: string;
  hireDate?: string;
  employmentProvince?: string;
  residenceProvince?: string;
  smoker?: string;
  occupationCode?: string;
  exempt?: string;
  bankTransit?: string;
  bankInstitution?: string;
  bankAccount?: string;
  salary?: number;
  salaryMode?: string;
  carrier: string;
  accountName?: string;
  accountId?: string;
  totalMonthlyPremium?: number;
  totalEmployeeCost?: number;
  totalEmployerCost?: number;
  benefits: CensusBenefit[];
  dependents: CensusDependent[];
  rawFields?: Record<string, any>;
}

/**
 * Universal Census Benefit Coverage Line
 */
export interface CensusBenefit {
  policyNumber: string;
  certificateNumber: string;
  benefitCode: string;
  benefitName: string;
  status: string;
  secondaryStatus?: string;
  coverageType?: string; // 'SINGLE' | 'FAMILY' | 'COUPLE'
  coverageAmount?: number | string;
  monthlyPremium?: number;
  effectiveDate?: string;
  processDate?: string;
  eligible?: string;
  salary?: number;
  salaryMode?: string;
}

/**
 * Universal Census Dependent / Beneficiary Line
 */
export interface CensusDependent {
  policyNumber: string;
  certificateNumber: string;
  dependentName: string;
  relationshipCode: string; // 'SP' | 'DT' | 'SN' | 'CL' | 'PR' | 'OT'
  relationship: string;     // 'Spouse' | 'Daughter' | 'Son' | 'Common-Law' | 'Parent' | 'Other'
  effectiveDate?: string;
  terminationDate?: string;
  covered?: string;
  province?: string;
}

/**
 * Canada Life Specific Model: ENROLLEMP.TXT (40 Columns)
 */
export interface CanadaLifeEnrollEmpRecord {
  policyNumber: string;          // Col 0: Policy # (e.g. 335760)
  divisionSub?: string;          // Col 1: Division Subgroup
  certificateNumber: string;     // Col 2: Certificate #
  lastName: string;              // Col 3: Employee Last Name
  firstName: string;             // Col 4: Employee First Name
  memberType: string;            // Col 5: Class/Role (e.g. PART)
  effectiveDate: string;         // Col 6: Effective Date (YYYY-MM-DD)
  processDate: string;           // Col 7: Process Date
  division: string;              // Col 8: Division (e.g. 1)
  classCode: string;             // Col 9: Class Code (e.g. 1)
  subclassCode?: string;         // Col 10: Subclass (e.g. 1)
  col11?: string;                // Col 11
  terminationDate?: string;      // Col 12: Termination Date (if terminated)
  col13?: string;                // Col 13
  birthDate: string;             // Col 14: DOB (YYYY-MM-DD)
  gender: string;                // Col 15: Gender (M/F)
  language: string;              // Col 16: Preferred Language (E/F)
  address: string;               // Col 17: Street Address
  city: string;                  // Col 18: City
  province: string;              // Col 19: Province (BC, etc.)
  postalCode: string;            // Col 20: Postal Code
  phone?: string;                // Col 21: Phone Number
  hireDate: string;              // Col 22: Hire Date (YYYY-MM-DD)
  employmentProvince: string;    // Col 23: Province of Employment
  residenceProvince: string;     // Col 24: Province of Residence
  smokerStatus: string;          // Col 25: Smoker (N/Y)
  col26?: string;                // Col 26
  occupationCode?: string;       // Col 27: Occupation / Dept Code
  exemptStatus?: string;         // Col 28: Exempt (N/Y)
  maritalEligibility?: string;   // Col 29: Flag
  col30?: string;                // Col 30
  col31?: string;                // Col 31
  bankTransit?: string;          // Col 32: Bank Transit Number
  bankInstitution?: string;      // Col 33: Bank Institution Code
  bankAccount?: string;          // Col 34: Bank Account Number
  salary?: number;               // Col 35: Salary / Earnings Amount
  salaryMode?: string;           // Col 36: Frequency (A = Annual, H = Hourly)
  col37?: string;                // Col 37
  enrollmentStatus: string;      // Col 38: Status ("TERMINATED" | "EARNINGS" | "ACTIVE")
  adminId?: string;              // Col 39: Admin or System User ID
}

/**
 * Canada Life Specific Model: ENROLLBFT.TXT (20 Columns)
 */
export interface CanadaLifeEnrollBftRecord {
  policyNumber: string;          // Col 0: Policy # (e.g. 335760)
  col1?: string;                 // Col 1
  certificateNumber: string;     // Col 2: Certificate #
  lastName: string;              // Col 3: Member Last Name
  firstName: string;             // Col 4: Member First Name
  memberType: string;            // Col 5: Member Type (PART)
  effectiveDate: string;         // Col 6: Effective Date
  processDate: string;           // Col 7: Process Date
  division: string;              // Col 8: Division
  classCode: string;             // Col 9: Class
  benefitCode: string;           // Col 10: Benefit (AD&D, BLIFE, CNTCT, DENT, HCARE)
  subcode?: string;              // Col 11
  status: string;                // Col 12: Benefit Status (IN-FORCE, TERMINATED)
  secondaryStatus?: string;      // Col 13
  coverageType?: string;         // Col 14: Coverage Tier (FAMILY, SINGLE, COUPLE)
  coverageAmount?: number;       // Col 15: Coverage Volume / Sum Insured
  lateApplicant?: string;        // Col 16: Late Applicant Flag (N/Y)
  eligible?: string;             // Col 17: Eligibility (Y/N)
  salary?: number;               // Col 18: Salary
  salaryMode?: string;           // Col 19: Salary Mode
}

/**
 * Canada Life Specific Model: ENROLLBNC.TXT (14 Columns)
 */
export interface CanadaLifeEnrollBncRecord {
  policyNumber: string;          // Col 0: Policy #
  col1?: string;                 // Col 1
  certificateNumber: string;     // Col 2: Certificate #
  lastName: string;              // Col 3: Member Last Name
  firstName: string;             // Col 4: Member First Name
  memberType: string;            // Col 5: Member Type
  effectiveDate: string;         // Col 6: Effective Date
  division: string;              // Col 7: Division
  classCode: string;             // Col 8: Class
  terminationDate?: string;      // Col 9: Termination / Change Date
  dependentName: string;         // Col 10: Dependent Full Name
  relationshipCode: string;      // Col 11: Relationship (SP, DT, SN, CL, PR, OT)
  covered: string;               // Col 12: Covered / Active (Y/N)
  province?: string;             // Col 13: Province
}

// Backward-compatibility aliases
export type ManuLifeEnrollEmpRecord = CanadaLifeEnrollEmpRecord;
export type ManuLifeEnrollBftRecord = CanadaLifeEnrollBftRecord;
export type ManuLifeEnrollBncRecord = CanadaLifeEnrollBncRecord;

/**
 * ManuLife Benefit Line (7 Columns per Benefit)
 */
export interface ManuLifeCensusBenefitLine {
  planCode?: string;                 // e.g. "AA"
  volumeOrTier?: string | number;    // e.g. 165000, "Family", "Single", 1054, 3708
  option?: string;                   // e.g. "AA"
  currentMonthPremium?: number;      // e.g. 30.53
  priorPeriodAdjustments?: number;   // Prior Period Adjustments' Premium
  totalSalesTax?: number;            // Total Sales Tax
  benefitTotal?: number;             // Benefit Total (e.g. 30.53)
}

/**
 * ManuLife Member Detail Billing Census Model (65 Columns)
 * Corresponds to Excel Sheet: 120124_MemberDetailCommaDel
 */
export interface ManuLifeCensusRecord {
  // Member Identification & Demographics (Cols 0-8)
  certificateNumber: string;         // Col 0: "1"
  lastName: string;                  // Col 1: "ADAM"
  firstName: string;                 // Col 2: "JOANNA"
  className: string;                 // Col 3: "101 - Mulgrave Independent School Society"
  classCode: string | number;        // Col 4: 101
  planName: string;                  // Col 5: "AA - Employees"
  planCode: string;                  // Col 6: "AA"
  provinceOfWork: string;            // Col 7: "BC"
  provinceOfResidence: string;       // Col 8: "BC"

  // Overall Premiums & Taxes (Cols 9-12)
  currentMonthPremium: number;       // Col 9: "All Benefits - Current Month Premium (1)" (e.g. 554.70)
  priorPeriodAdjustments?: number;   // Col 10: "All Benefits - Prior Period Adjustments' Premium (2)"
  totalSalesTax?: number;            // Col 11: "All Benefits - Total Sales Tax (3)"
  totalPremiumAndTax: number;        // Col 12: "All Benefits - Total Premium & Tax (4)" (e.g. 554.70)

  // Individual Benefit Coverages (7 Benefits x 7 Columns = Cols 13-61)
  eli: ManuLifeCensusBenefitLine;    // Cols 13-19: Employee Life Insurance (ELI)
  dli: ManuLifeCensusBenefitLine;    // Cols 20-26: Dependent Life Insurance (DLI)
  add: ManuLifeCensusBenefitLine;    // Cols 27-33: Accidental Death & Dismemberment (ADD)
  ehc: ManuLifeCensusBenefitLine;    // Cols 34-40: Extended Health Care (EHC)
  den: ManuLifeCensusBenefitLine;    // Cols 41-47: Dental Benefits (DEN)
  std: ManuLifeCensusBenefitLine;    // Cols 48-54: Short Term Disability (STD)
  ltd: ManuLifeCensusBenefitLine;    // Cols 55-61: Long Term Disability (LTD)

  // Bill Totals (Cols 62-64)
  billTotal5?: string;               // Col 62: "Bill Total 5"
  billTotal6?: string;               // Col 63: "Bill Total 6"
  billTotal7?: string;               // Col 64: "Bill Total 7"
}

/**
 * GroupSource Billing & Premium Census Record (56 Columns)
 */
export interface GroupSourceCensusRecord {
  // Identification & Demographics
  ledger: string;                 // Col 0: e.g. "A07837" (Employer Ledger ID)
  pin: string;                    // Col 1: e.g. "111-528-524C" (Certificate / Member PIN)
  lastName: string;               // Col 2: e.g. "ABDELLI"
  firstName: string;              // Col 3: e.g. "ALDJIA"
  annualEarnings: number;         // Col 4: e.g. 37182.60
  classCode: string;              // Col 5: e.g. "04"
  costCode: string;               // Col 6: e.g. "001"
  employeeNumber: string;         // Col 7: e.g. "11242"
  reportClass?: string;           // Col 8: Report Class
  occupation: string;             // Col 9: e.g. "ECE EDUCATOR"
  overallEffectiveDate: string;   // Col 10: e.g. "2023-11-06"
  employmentDate: string;         // Col 11: e.g. "2023-11-06" (Hire Date)
  employeeAddress: string;        // Col 12: e.g. "1739 BLAIR AVE"
  employeeCity: string;           // Col 13: e.g. "VICTORIA"
  employeeProvince: string;       // Col 14: e.g. "BC"
  employeeBirthDate: string;      // Col 15: e.g. "1965-06-26"
  status: string;                 // Col 16: e.g. "Active"
  email: string;                  // Col 17: e.g. "AABDELLI@STMARG.CA"
  personalEmail?: string;         // Col 18: e.g. "ALDJIAABDELLI1@GMAIL.COM"
  gender: 'M' | 'F' | string;     // Col 19: e.g. "F"
  employeeFamilyStatus: 'S' | 'C' | 'F' | string; // Col 20: 'S' Single, 'C' Couple, 'F' Family
  employeeLabel?: string;         // Col 21
  currentRetroPremium?: string;   // Col 22: e.g. "Total"

  // Benefit Coverage Columns: Volume/Level, Monthly Premium Total, Effective Date
  lifeVolume: string | number;    // Col 23: "50,000"
  lifeTotal: number;              // Col 24: 11.90
  lifeEffDate: string;            // Col 25: "2023-11-06"

  addVolume: string | number;     // Col 26: "50,000"
  addTotal: number;               // Col 27: 2.00
  addEffDate: string;             // Col 28: "2023-11-06"

  stdVolume: string | number;     // Col 29: "501" (Weekly Benefit)
  stdTotal: number;               // Col 30: 42.03
  stdEffDate: string;             // Col 31: "2023-11-06"

  ltdVolume: string | number;     // Col 32: "2,066" (Monthly Benefit)
  ltdTotal: number;               // Col 33: 81.01
  ltdEffDate: string;             // Col 34: "2023-11-06"

  depLifeVolume: string;          // Col 35: "Y" / "N"
  depLifeTotal: number;           // Col 36: 2.39
  depLifeEffDate: string;         // Col 37: "2023-11-06"

  healthVolume: string;           // Col 38: "S" / "C" / "F"
  healthTotal: number;            // Col 39: 97.35
  healthEffDate: string;          // Col 40: "2023-11-06"

  dentalVolume: string;           // Col 41: "S" / "C" / "F"
  dentalTotal: number;            // Col 42: 62.39
  dentalEffDate: string;          // Col 43: "2023-11-06"

  hsaVolume: string;              // Col 44: "S" / "C" / "F"
  hsaTotal: number;               // Col 45: 45.00
  hsaEffDate: string;             // Col 46: "2023-11-06"

  efapVolume: string;             // Col 47: "0"
  efapTotal: number;              // Col 48: 2.63
  efapEffDate: string;            // Col 49: "2026-07-01"

  virtualHealthVolume: string;    // Col 50: "0"
  virtualHealthTotal: number;     // Col 51: 1.79
  virtualHealthEffDate: string;   // Col 52: "2026-07-01"

  // Cost Contribution Totals
  totalEe: number;                // Col 53: 123.04 (Employee Paid)
  totalEr: number;                // Col 54: 225.45 (Employer Paid)
  totalMonthlyPremium: number;    // Col 55: 348.49 (Total Monthly Premium)
}

/**
 * Canada Life Generic Record
 */
export interface CanadaLifeCensusRecord {
  policyNumber: string;
  certificateNumber: string;
  firstName: string;
  lastName: string;
  [key: string]: any;
}

/**
 * Specification Descriptor for UI Carrier Selector
 */
export interface CarrierCensusFormatSpec {
  carrierId: string;
  carrierName: string;
  expectedFiles: string[];
  description: string;
  fileFormat: string;
}

/**
 * Backend Census Import Response
 */
export interface CensusImportResult {
  success: boolean;
  carrier: string;
  policyNumber?: string;
  totalEmployees: number;
  totalBenefits: number;
  totalDependents: number;
  importedContacts?: number;
  newContacts?: number;
  updatedContacts?: number;
  importedIndividuals: number;
  newIndividuals?: number;
  updatedIndividuals: number;
  matchedAccount?: string;
  filesProcessed: string[];
  employeesSample: CensusEmployee[];
  errors: Array<{ record: string; message: string }>;
}
