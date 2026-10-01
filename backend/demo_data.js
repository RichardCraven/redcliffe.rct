const crypto = require('crypto');

function hashPassword(password, salt = 'redcliffe_salt_2026') {
  return crypto.createHmac('sha256', salt).update(password).digest('hex');
}

function escapeSql(val) {
  if (val === null || val === undefined) return 'NULL';
  if (typeof val === 'number') return val;
  if (typeof val === 'boolean') return val ? 1 : 0;
  return "'" + String(val).replace(/'/g, "''") + "'";
}

const DEMO_USERS = [
  {
    id: 'usr-demo-test',
    user_name: 'test',
    password_hash: hashPassword('test'),
    first_name: 'Alex',
    last_name: 'Morgan',
    email1: 'test@demofinancial.llc',
    status: 'Active',
    is_admin: 1,
    description: 'Lead Benefits Advisor & Portfolio Director'
  },
  {
    id: 'usr-demo-jdoe',
    user_name: 'jdoe',
    password_hash: hashPassword('password123'),
    first_name: 'Jane',
    last_name: 'Doe',
    email1: 'jdoe@demofinancial.llc',
    status: 'Active',
    is_admin: 0,
    description: 'Senior Underwriting & Benefits Specialist'
  },
  {
    id: 'usr-demo-asmith',
    user_name: 'asmith',
    password_hash: hashPassword('password123'),
    first_name: 'Arthur',
    last_name: 'Smith',
    email1: 'asmith@demofinancial.llc',
    status: 'Active',
    is_admin: 0,
    description: 'Group Retirement & Wealth Consultant'
  }
];

const DEMO_ACCOUNTS = [
  {
    id: 'acc-demo-1',
    name: 'Apex Horizon Technologies',
    account_type: 'Group Client – Benefits; Group Client – Retirement',
    email1: 'benefits@apexhorizon.demo',
    website: 'https://apexhorizon.demo',
    industry: 'Technology',
    description: 'Fast-growing cloud software consultancy headquartered in downtown Vancouver. Comprehensive group benefits covering 145 salaried software engineers, product managers, and support personnel. Annual renewal scheduled with Sun Life.',
    shipping_address_city: 'Vancouver',
    shipping_address_state: 'BC',
    renewal_date: '2026-11-01',
    carrier_tpa: 'Sun Life Financial',
    num_employees: '145'
  },
  {
    id: 'acc-demo-2',
    name: 'Beacon BioTech Solutions',
    account_type: 'Group Client – Benefits',
    email1: 'hr@beaconbiotech.demo',
    website: 'https://beaconbiotech.demo',
    industry: 'Biotechnology',
    description: 'Clinical genomics laboratory specializing in precision oncology diagnostics. Plan features an enhanced drug formulary with high paramedical practitioner limits and specialized critical illness riders.',
    shipping_address_city: 'Toronto',
    shipping_address_state: 'ON',
    renewal_date: '2026-12-01',
    carrier_tpa: 'Manulife Financial',
    num_employees: '68'
  },
  {
    id: 'acc-demo-3',
    name: 'Cascade Mountain Logistics',
    account_type: 'Group Client – Benefits; Group Client – Retirement',
    email1: 'operations@cascadelogistics.demo',
    website: 'https://cascadelogistics.demo',
    industry: 'Logistics & Supply Chain',
    description: 'Intermodal freight distribution and cold storage network across Western Canada. Distinct class structures for corporate executive staff and fleet transport drivers. Group RRSP with 4% employer matching.',
    shipping_address_city: 'Calgary',
    shipping_address_state: 'AB',
    renewal_date: '2027-01-01',
    carrier_tpa: 'Canada Life',
    num_employees: '210'
  },
  {
    id: 'acc-demo-4',
    name: 'Crestview Academy',
    account_type: 'Group Client – Benefits',
    email1: 'bursar@crestviewacademy.demo',
    website: 'https://crestviewacademy.demo',
    industry: 'Education',
    description: 'Independent K-12 preparatory academy on Vancouver Island. Premium health, dental, and comprehensive Employee and Family Assistance Program (EFAP) with direct practitioner billing through Pacific Blue Cross.',
    shipping_address_city: 'Victoria',
    shipping_address_state: 'BC',
    renewal_date: '2027-02-01',
    carrier_tpa: 'Pacific Blue Cross',
    num_employees: '92'
  },
  {
    id: 'acc-demo-5',
    name: 'Helios Clean Energy',
    account_type: 'Group Client – Benefits; Group Client – Retirement',
    email1: 'people@heliosenergy.demo',
    website: 'https://heliosenergy.demo',
    industry: 'Clean Energy',
    description: 'Utility-scale solar grid infrastructure and storage manufacturer. Progressive wellness spending account (WSA) and flexible lifestyle allowances designed to attract engineering specialists.',
    shipping_address_city: 'Vancouver',
    shipping_address_state: 'BC',
    renewal_date: '2027-03-01',
    carrier_tpa: 'Sun Life Financial',
    num_employees: '185'
  },
  {
    id: 'acc-demo-6',
    name: 'Meridian Legal Group',
    account_type: 'Group Client – Benefits',
    email1: 'admin@meridianlegal.demo',
    website: 'https://meridianlegal.demo',
    industry: 'Legal Services',
    description: 'Corporate securities and commercial arbitration boutique law firm. Customized partner disability carve-out structure with integrated cost-plus healthcare spending accounts.',
    shipping_address_city: 'Toronto',
    shipping_address_state: 'ON',
    renewal_date: '2026-10-15',
    carrier_tpa: 'Desjardins Insurance',
    num_employees: '48'
  },
  {
    id: 'acc-demo-7',
    name: 'Nova Dynamics Robotics',
    account_type: 'Group Client – Benefits; Group Client – Retirement',
    email1: 'contact@novadynamics.demo',
    website: 'https://novadynamics.demo',
    industry: 'Manufacturing & Robotics',
    description: 'Industrial automated assembly and robotics manufacturing firm. Group health with custom stop-loss insurance pooling, short-term disability self-insured salary continuance, and long-term disability.',
    shipping_address_city: 'Montreal',
    shipping_address_state: 'QC',
    renewal_date: '2026-11-15',
    carrier_tpa: 'Manulife Financial',
    num_employees: '310'
  },
  {
    id: 'acc-demo-8',
    name: 'Pacific Coast Media',
    account_type: 'Group Client – Benefits',
    email1: 'studio@pacificcoastmedia.demo',
    website: 'https://pacificcoastmedia.demo',
    industry: 'Digital Media',
    description: 'Visual effects, animation, and post-production creative studio. Modular healthcare plan featuring enhanced mental health psychological counseling and prescription vision care.',
    shipping_address_city: 'Vancouver',
    shipping_address_state: 'BC',
    renewal_date: '2027-04-01',
    carrier_tpa: 'Canada Life',
    num_employees: '55'
  },
  {
    id: 'acc-demo-9',
    name: 'Pinnacle Health Partners',
    account_type: 'Group Client – Benefits',
    email1: 'hr@pinnaclehealth.demo',
    website: 'https://pinnaclehealth.demo',
    industry: 'Healthcare',
    description: 'Regional network of multidisciplinary sports injury and rehabilitation clinics. Competitive major medical and dental coverage with emergency travel assistance riders.',
    shipping_address_city: 'Edmonton',
    shipping_address_state: 'AB',
    renewal_date: '2027-05-01',
    carrier_tpa: 'Pacific Blue Cross',
    num_employees: '175'
  },
  {
    id: 'acc-demo-10',
    name: 'Sterling Financial Advisors',
    account_type: 'Group Client – Benefits; Group Client – Retirement',
    email1: 'info@sterlingfinancial.demo',
    website: 'https://sterlingfinancial.demo',
    industry: 'Financial Services',
    description: 'Private wealth advisory and institutional portfolio consultancy. Executive life insurance, partner buy-sell disability coverage, and tax-sheltered executive healthcare accounts.',
    shipping_address_city: 'Calgary',
    shipping_address_state: 'AB',
    renewal_date: '2026-12-15',
    carrier_tpa: 'Sun Life Financial',
    num_employees: '38'
  },
  {
    id: 'acc-demo-11',
    name: 'Summit Outdoor Gear',
    account_type: 'Group Client – Benefits',
    email1: 'retail@summitgear.demo',
    website: 'https://summitgear.demo',
    industry: 'Retail & Consumer Goods',
    description: 'Technical alpine apparel and backcountry expedition retailer. Cost-effective pooled group benefits plan paired with integrated telemedicine and digital pharmacy fulfillment.',
    shipping_address_city: 'Kelowna',
    shipping_address_state: 'BC',
    renewal_date: '2027-01-15',
    carrier_tpa: 'Desjardins Insurance',
    num_employees: '85'
  },
  {
    id: 'acc-demo-12',
    name: 'Zenith Cloud Systems',
    account_type: 'Group Client – Benefits; Group Client – Retirement',
    email1: 'security@zenithcloud.demo',
    website: 'https://zenithcloud.demo',
    industry: 'Cloud Infrastructure',
    description: 'Enterprise zero-trust cybersecurity and distributed storage infrastructure. 100% employer-funded dental and prescription drug coverage with $2,000 annual Healthcare Spending Accounts.',
    shipping_address_city: 'Vancouver',
    shipping_address_state: 'BC',
    renewal_date: '2027-02-15',
    carrier_tpa: 'Canada Life',
    num_employees: '120'
  }
];

const DEMO_CARRIERS = [
  {
    id: 'car-sunlife',
    carrier: 'Sun Life Financial',
    description: 'Comprehensive group benefits carrier offering extended health, dental, disability, and group life underwriting with robust digital member claims.',
    clientIdentifier: 'Policy Number',
    clients: JSON.stringify(['Apex Horizon Technologies', 'Helios Clean Energy', 'Sterling Financial Advisors'])
  },
  {
    id: 'car-manulife',
    carrier: 'Manulife Financial',
    description: 'Leading Canadian group retirement and employee benefits provider specializing in pooled risk structures, Vitality wellness programs, and disability management.',
    clientIdentifier: 'Certificate Number',
    clients: JSON.stringify(['Beacon BioTech Solutions', 'Nova Dynamics Robotics'])
  },
  {
    id: 'car-canadalife',
    carrier: 'Canada Life',
    description: 'Full-service national group insurer providing customizable healthcare spending accounts, modular benefits, and group retirement solutions.',
    clientIdentifier: 'Policy Number',
    clients: JSON.stringify(['Cascade Mountain Logistics', 'Pacific Coast Media', 'Zenith Cloud Systems'])
  },
  {
    id: 'car-pbc',
    carrier: 'Pacific Blue Cross',
    description: 'Regional health and dental benefits carrier with direct practitioner claims billing, extensive pharmacy networks, and provincial coverage.',
    clientIdentifier: 'Group ID',
    clients: JSON.stringify(['Crestview Academy', 'Pinnacle Health Partners'])
  },
  {
    id: 'car-desjardins',
    carrier: 'Desjardins Insurance',
    description: 'Cooperative financial group offering competitive group insurance, cost-plus healthcare accounts, and employee assistance programs.',
    clientIdentifier: 'Contract Number',
    clients: JSON.stringify(['Meridian Legal Group', 'Summit Outdoor Gear'])
  }
];

const DEMO_INDIVIDUALS = [
  // Apex Horizon Technologies
  {
    id: 'ind-demo-1',
    account_id: 'acc-demo-1',
    account_name: 'Apex Horizon Technologies',
    name: 'Sarah Jenkins',
    email: 'sjenkins@apexhorizon.demo',
    phone: '(604) 555-0142',
    role: 'Plan Administrator',
    status: 'Active',
    notes: 'Primary liaison for annual renewal, carrier rate negotiation, and employee enrollment onboarding.'
  },
  {
    id: 'ind-demo-2',
    account_id: 'acc-demo-1',
    account_name: 'Apex Horizon Technologies',
    name: 'Marcus Vance',
    email: 'mvance@apexhorizon.demo',
    phone: '(604) 555-0199',
    role: 'Chief Technology Officer',
    status: 'Active',
    notes: 'Executive plan member; participating in executive carve-out critical illness and enhanced AD&D.'
  },
  {
    id: 'ind-demo-3',
    account_id: 'acc-demo-1',
    account_name: 'Apex Horizon Technologies',
    name: 'Liam O\'Connor',
    email: 'loconnor@apexhorizon.demo',
    phone: '(604) 555-0183',
    role: 'Plan Member',
    status: 'Active',
    notes: 'Senior DevOps Architect. Enrolled in family dental and extended health.'
  },
  {
    id: 'ind-demo-4',
    account_id: 'acc-demo-1',
    account_name: 'Apex Horizon Technologies',
    name: 'Chloe Bennett',
    email: 'cbennett@apexhorizon.demo',
    phone: '(604) 555-0131',
    role: 'Plan Member',
    status: 'Active',
    notes: 'Product Design Lead. HSA allocation utilized for laser eye surgery rider.'
  },

  // Beacon BioTech Solutions
  {
    id: 'ind-demo-5',
    account_id: 'acc-demo-2',
    account_name: 'Beacon BioTech Solutions',
    name: 'Dr. Elena Rostova',
    email: 'erostova@beaconbiotech.demo',
    phone: '(416) 555-0112',
    role: 'Plan Administrator',
    status: 'Active',
    notes: 'VP of Clinical Operations & Primary Plan Administrator. Point of contact for paramedical caps.'
  },
  {
    id: 'ind-demo-6',
    account_id: 'acc-demo-2',
    account_name: 'Beacon BioTech Solutions',
    name: 'David Campbell',
    email: 'dcampbell@beaconbiotech.demo',
    phone: '(416) 555-0177',
    role: 'Director of Laboratory Operations',
    status: 'Active',
    notes: 'Authorized signatory for billing reconciliations and claims pooling reports.'
  },
  {
    id: 'ind-demo-7',
    account_id: 'acc-demo-2',
    account_name: 'Beacon BioTech Solutions',
    name: 'Sophia Patel',
    email: 'spatel@beaconbiotech.demo',
    phone: '(416) 555-0149',
    role: 'Plan Member',
    status: 'Active',
    notes: 'Senior Research Biologist. Enrolled in Manulife Vitality program.'
  },

  // Cascade Mountain Logistics
  {
    id: 'ind-demo-8',
    account_id: 'acc-demo-3',
    account_name: 'Cascade Mountain Logistics',
    name: 'Robert Taylor',
    email: 'rtaylor@cascadelogistics.demo',
    phone: '(403) 555-0164',
    role: 'Plan Administrator',
    status: 'Active',
    notes: 'VP Operations & Plan Administrator. Manages group retirement enrollments and driver benefits.'
  },
  {
    id: 'ind-demo-9',
    account_id: 'acc-demo-3',
    account_name: 'Cascade Mountain Logistics',
    name: 'Amanda White',
    email: 'awhite@cascadelogistics.demo',
    phone: '(403) 555-0128',
    role: 'HR Coordinator',
    status: 'Terminated',
    notes: 'Former HR coordinator. Transitioned off plan in August 2026.'
  },
  {
    id: 'ind-demo-10',
    account_id: 'acc-demo-3',
    account_name: 'Cascade Mountain Logistics',
    name: 'Jason Miller',
    email: 'jmiller@cascadelogistics.demo',
    phone: '(403) 555-0195',
    role: 'Plan Member',
    status: 'Active',
    notes: 'Fleet Dispatch Supervisor. Family dental plan with major restorative coverage.'
  },

  // Crestview Academy
  {
    id: 'ind-demo-11',
    account_id: 'acc-demo-4',
    account_name: 'Crestview Academy',
    name: 'Margaret Thornton',
    email: 'mthornton@crestviewacademy.demo',
    phone: '(250) 555-0155',
    role: 'Plan Administrator',
    status: 'Active',
    notes: 'Head of School. Primary contact for Pacific Blue Cross faculty group renewal.'
  },
  {
    id: 'ind-demo-12',
    account_id: 'acc-demo-4',
    account_name: 'Crestview Academy',
    name: 'Brian Fraser',
    email: 'bfraser@crestviewacademy.demo',
    phone: '(250) 555-0182',
    role: 'Bursar & Finance Director',
    status: 'Active',
    notes: 'Oversees benefit premiums and fiscal year pension remittance.'
  },
  {
    id: 'ind-demo-13',
    account_id: 'acc-demo-4',
    account_name: 'Crestview Academy',
    name: 'Claire Dubois',
    email: 'cdubois@crestviewacademy.demo',
    phone: '(250) 555-0161',
    role: 'Plan Member',
    status: 'Active',
    notes: 'Senior Mathematics Department Head. Covered under Single extended health.'
  },

  // Helios Clean Energy
  {
    id: 'ind-demo-14',
    account_id: 'acc-demo-5',
    account_name: 'Helios Clean Energy',
    name: 'Lucas Ramirez',
    email: 'lramirez@heliosenergy.demo',
    phone: '(604) 555-0136',
    role: 'Plan Administrator',
    status: 'Active',
    notes: 'Director of People & Culture. Champion for mental wellness programs and lifestyle accounts.'
  },
  {
    id: 'ind-demo-15',
    account_id: 'acc-demo-5',
    account_name: 'Helios Clean Energy',
    name: 'Maya Lin',
    email: 'mlin@heliosenergy.demo',
    phone: '(604) 555-0174',
    role: 'Chief Operating Officer',
    status: 'Active',
    notes: 'Executive committee signatory on group insurance renewals.'
  },
  {
    id: 'ind-demo-16',
    account_id: 'acc-demo-5',
    account_name: 'Helios Clean Energy',
    name: 'Zachary King',
    email: 'zking@heliosenergy.demo',
    phone: '(604) 555-0122',
    role: 'Plan Member',
    status: 'Active',
    notes: 'High-voltage grid engineer. Active participant in Group RRSP match.'
  },

  // Meridian Legal Group
  {
    id: 'ind-demo-17',
    account_id: 'acc-demo-6',
    account_name: 'Meridian Legal Group',
    name: 'Victoria Sterling',
    email: 'vsterling@meridianlegal.demo',
    phone: '(416) 555-0188',
    role: 'Plan Administrator',
    status: 'Active',
    notes: 'Managing Partner. Manages partner disability carve-out and executive health audits.'
  },
  {
    id: 'ind-demo-18',
    account_id: 'acc-demo-6',
    account_name: 'Meridian Legal Group',
    name: 'Alexander Ross',
    email: 'aross@meridianlegal.demo',
    phone: '(416) 555-0103',
    role: 'Practice Administrator',
    status: 'Active',
    notes: 'Liaison for associate billing and Desjardins cost-plus reimbursement.'
  },

  // Nova Dynamics Robotics
  {
    id: 'ind-demo-19',
    account_id: 'acc-demo-7',
    account_name: 'Nova Dynamics Robotics',
    name: 'Henri Bouchard',
    email: 'hbouchard@novadynamics.demo',
    phone: '(514) 555-0191',
    role: 'Plan Administrator',
    status: 'Active',
    notes: 'Director of Human Resources. Manages manufacturing floor health and safety benefits.'
  },
  {
    id: 'ind-demo-20',
    account_id: 'acc-demo-7',
    account_name: 'Nova Dynamics Robotics',
    name: 'Julien Moreau',
    email: 'jmoreau@novadynamics.demo',
    phone: '(514) 555-0145',
    role: 'Plan Member',
    status: 'Terminated',
    notes: 'Robotics Assembly Specialist. Policy terminated on record; census record archived.'
  },
  {
    id: 'ind-demo-21',
    account_id: 'acc-demo-7',
    account_name: 'Nova Dynamics Robotics',
    name: 'Natalie Wong',
    email: 'nwong@novadynamics.demo',
    phone: '(514) 555-0179',
    role: 'Plan Member',
    status: 'Active',
    notes: 'Automation Systems Engineer. Family coverage for prescription drugs and orthodontic dental.'
  },

  // Pacific Coast Media
  {
    id: 'ind-demo-22',
    account_id: 'acc-demo-8',
    account_name: 'Pacific Coast Media',
    name: 'Jordan Ellis',
    email: 'jellis@pacificcoastmedia.demo',
    phone: '(604) 555-0117',
    role: 'Plan Administrator',
    status: 'Active',
    notes: 'Studio Producer & Benefits Coordinator. Primary contact for Canada Life wellness portal.'
  },
  {
    id: 'ind-demo-23',
    account_id: 'acc-demo-8',
    account_name: 'Pacific Coast Media',
    name: 'Tyler Chen',
    email: 'tchen@pacificcoastmedia.demo',
    phone: '(604) 555-0168',
    role: 'Plan Member',
    status: 'Active',
    notes: 'Lead Compositor. Vision care allowance utilized for specialized corrective lenses.'
  },

  // Pinnacle Health Partners
  {
    id: 'ind-demo-24',
    account_id: 'acc-demo-9',
    account_name: 'Pinnacle Health Partners',
    name: 'Dr. Katherine Walsh',
    email: 'kwalsh@pinnaclehealth.demo',
    phone: '(780) 555-0152',
    role: 'Plan Administrator',
    status: 'Active',
    notes: 'Chief Medical Officer. Oversees practitioner health benefits and group travel insurance.'
  },
  {
    id: 'ind-demo-25',
    account_id: 'acc-demo-9',
    account_name: 'Pinnacle Health Partners',
    name: 'Jessica Miller',
    email: 'jmiller@pinnaclehealth.demo',
    phone: '(780) 555-0193',
    role: 'Plan Member',
    status: 'Active',
    notes: 'Senior Physiotherapist. Full family dental and major medical.'
  },

  // Sterling Financial Advisors
  {
    id: 'ind-demo-26',
    account_id: 'acc-demo-10',
    account_name: 'Sterling Financial Advisors',
    name: 'Christopher Sterling',
    email: 'csterling@sterlingfinancial.demo',
    phone: '(403) 555-0105',
    role: 'Plan Administrator',
    status: 'Active',
    notes: 'Managing Director & Principal Advisor. Focus on key person insurance and executive pooling.'
  },
  {
    id: 'ind-demo-27',
    account_id: 'acc-demo-10',
    account_name: 'Sterling Financial Advisors',
    name: 'Melanie Ward',
    email: 'mward@sterlingfinancial.demo',
    phone: '(403) 555-0139',
    role: 'Senior Wealth Strategist',
    status: 'Active',
    notes: 'Group RRSP and TFSA portfolio lead.'
  },

  // Summit Outdoor Gear
  {
    id: 'ind-demo-28',
    account_id: 'acc-demo-11',
    account_name: 'Summit Outdoor Gear',
    name: 'Derek Olson',
    email: 'dolson@summitgear.demo',
    phone: '(250) 555-0114',
    role: 'Plan Administrator',
    status: 'Active',
    notes: 'Operations Director. Coordinates retail store employee benefits across 4 regional branches.'
  },
  {
    id: 'ind-demo-29',
    account_id: 'acc-demo-11',
    account_name: 'Summit Outdoor Gear',
    name: 'Heather Davies',
    email: 'hdavies@summitgear.demo',
    phone: '(250) 555-0171',
    role: 'Plan Member',
    status: 'Active',
    notes: 'E-commerce logistics manager. Enrolled in telemedicine app and prescription delivery.'
  },

  // Zenith Cloud Systems
  {
    id: 'ind-demo-30',
    account_id: 'acc-demo-12',
    account_name: 'Zenith Cloud Systems',
    name: 'Nicole Armstrong',
    email: 'narmstrong@zenithcloud.demo',
    phone: '(604) 555-0158',
    role: 'Plan Administrator',
    status: 'Active',
    notes: 'Head of People. Manages Canada Life custom flex credits and HSA administration.'
  },
  {
    id: 'ind-demo-31',
    account_id: 'acc-demo-12',
    account_name: 'Zenith Cloud Systems',
    name: 'Kevin Zhang',
    email: 'kzhang@zenithcloud.demo',
    phone: '(604) 555-0125',
    role: 'Plan Member',
    status: 'Active',
    notes: 'Principal Security Architect. Enrolled with spouse and 2 dependent children.'
  }
];

const DEMO_CENSUS_RECORDS = [
  // Sun Life - Apex Horizon Technologies
  {
    id: 'cen-demo-1',
    carrier: 'Sun Life Financial',
    policy_number: 'SL-109284',
    certificate_number: '00101',
    employee_name: 'Sarah Jenkins',
    first_name: 'Sarah',
    last_name: 'Jenkins',
    account_id: 'acc-demo-1',
    account_name: 'Apex Horizon Technologies',
    status: 'Active',
    salary: 135000,
    salary_mode: 'Annual',
    benefits_json: JSON.stringify([
      { benefitName: 'Basic Life Insurance', coverage: '2x Annual Earnings', volume: 270000, status: 'Approved' },
      { benefitName: 'Basic AD&D', coverage: '2x Annual Earnings', volume: 270000, status: 'Approved' },
      { benefitName: 'Extended Health Care', coverage: 'Family (100% Drugs / 80% Paramedical)', volume: 0, status: 'Enrolled' },
      { benefitName: 'Dental Care', coverage: 'Family (Basic, Major & Orthodontics)', volume: 0, status: 'Enrolled' },
      { benefitName: 'Long Term Disability', coverage: '66.7% Monthly Earnings', volume: 7500, status: 'Approved' },
      { benefitName: 'Healthcare Spending Account', coverage: 'Annual Allocation', volume: 1500, status: 'Enrolled' }
    ]),
    dependents_json: JSON.stringify([
      { dependentName: 'Thomas Jenkins', relationship: 'Spouse', relationshipCode: 'SP', dob: '1986-05-14', covered: 'Y' },
      { dependentName: 'Chloe Jenkins', relationship: 'Daughter', relationshipCode: 'DT', dob: '2016-09-22', covered: 'Y' },
      { dependentName: 'Noah Jenkins', relationship: 'Son', relationshipCode: 'SN', dob: '2019-11-03', covered: 'Y' }
    ]),
    raw_data: JSON.stringify({ division: 'Executive', province: 'BC', effectiveDate: '2022-04-01' })
  },
  {
    id: 'cen-demo-2',
    carrier: 'Sun Life Financial',
    policy_number: 'SL-109284',
    certificate_number: '00102',
    employee_name: 'Marcus Vance',
    first_name: 'Marcus',
    last_name: 'Vance',
    account_id: 'acc-demo-1',
    account_name: 'Apex Horizon Technologies',
    status: 'Active',
    salary: 175000,
    salary_mode: 'Annual',
    benefits_json: JSON.stringify([
      { benefitName: 'Basic Life Insurance', coverage: '2x Annual Earnings', volume: 350000, status: 'Approved' },
      { benefitName: 'Basic AD&D', coverage: '2x Annual Earnings', volume: 350000, status: 'Approved' },
      { benefitName: 'Extended Health Care', coverage: 'Family', volume: 0, status: 'Enrolled' },
      { benefitName: 'Dental Care', coverage: 'Family', volume: 0, status: 'Enrolled' },
      { benefitName: 'Long Term Disability', coverage: '66.7% Monthly Earnings', volume: 9720, status: 'Approved' }
    ]),
    dependents_json: JSON.stringify([
      { dependentName: 'Lillian Vance', relationship: 'Spouse', relationshipCode: 'SP', dob: '1984-12-08', covered: 'Y' }
    ]),
    raw_data: JSON.stringify({ division: 'Engineering', province: 'BC', effectiveDate: '2021-08-15' })
  },
  {
    id: 'cen-demo-3',
    carrier: 'Sun Life Financial',
    policy_number: 'SL-109284',
    certificate_number: '00103',
    employee_name: 'Liam O\'Connor',
    first_name: 'Liam',
    last_name: 'O\'Connor',
    account_id: 'acc-demo-1',
    account_name: 'Apex Horizon Technologies',
    status: 'Active',
    salary: 98000,
    salary_mode: 'Annual',
    benefits_json: JSON.stringify([
      { benefitName: 'Basic Life Insurance', coverage: '1.5x Annual Earnings', volume: 147000, status: 'Approved' },
      { benefitName: 'Basic AD&D', coverage: '1.5x Annual Earnings', volume: 147000, status: 'Approved' },
      { benefitName: 'Extended Health Care', coverage: 'Single', volume: 0, status: 'Enrolled' },
      { benefitName: 'Dental Care', coverage: 'Single', volume: 0, status: 'Enrolled' },
      { benefitName: 'Long Term Disability', coverage: '60% Monthly Earnings', volume: 4900, status: 'Approved' }
    ]),
    dependents_json: JSON.stringify([]),
    raw_data: JSON.stringify({ division: 'DevOps', province: 'BC', effectiveDate: '2023-01-10' })
  },
  {
    id: 'cen-demo-4',
    carrier: 'Sun Life Financial',
    policy_number: 'SL-109284',
    certificate_number: '00104',
    employee_name: 'Chloe Bennett',
    first_name: 'Chloe',
    last_name: 'Bennett',
    account_id: 'acc-demo-1',
    account_name: 'Apex Horizon Technologies',
    status: 'Active',
    salary: 92000,
    salary_mode: 'Annual',
    benefits_json: JSON.stringify([
      { benefitName: 'Basic Life Insurance', coverage: '1.5x Annual', volume: 138000, status: 'Approved' },
      { benefitName: 'Extended Health Care', coverage: 'Single', volume: 0, status: 'Enrolled' },
      { benefitName: 'Dental Care', coverage: 'Single', volume: 0, status: 'Enrolled' }
    ]),
    dependents_json: JSON.stringify([]),
    raw_data: JSON.stringify({ division: 'Product Design', province: 'BC', effectiveDate: '2023-03-01' })
  },

  // Manulife - Beacon BioTech Solutions
  {
    id: 'cen-demo-5',
    carrier: 'Manulife Financial',
    policy_number: 'ML-552910',
    certificate_number: '00201',
    employee_name: 'Dr. Elena Rostova',
    first_name: 'Elena',
    last_name: 'Rostova',
    account_id: 'acc-demo-2',
    account_name: 'Beacon BioTech Solutions',
    status: 'Active',
    salary: 165000,
    salary_mode: 'Annual',
    benefits_json: JSON.stringify([
      { benefitName: 'Executive Life Insurance', coverage: '3x Annual Earnings', volume: 495000, status: 'Approved' },
      { benefitName: 'Extended Health Care', coverage: 'Family (Executive Formulary)', volume: 0, status: 'Enrolled' },
      { benefitName: 'Dental Care', coverage: 'Family (Major & Ortho)', volume: 0, status: 'Enrolled' },
      { benefitName: 'Critical Illness Insurance', coverage: 'Lump Sum Benefit', volume: 100000, status: 'Approved' }
    ]),
    dependents_json: JSON.stringify([
      { dependentName: 'Mikhail Rostov', relationship: 'Spouse', relationshipCode: 'SP', dob: '1982-07-21', covered: 'Y' },
      { dependentName: 'Anya Rostova', relationship: 'Daughter', relationshipCode: 'DT', dob: '2015-03-10', covered: 'Y' }
    ]),
    raw_data: JSON.stringify({ division: 'Clinical Science', province: 'ON', effectiveDate: '2020-06-01' })
  },
  {
    id: 'cen-demo-6',
    carrier: 'Manulife Financial',
    policy_number: 'ML-552910',
    certificate_number: '00202',
    employee_name: 'David Campbell',
    first_name: 'David',
    last_name: 'Campbell',
    account_id: 'acc-demo-2',
    account_name: 'Beacon BioTech Solutions',
    status: 'Active',
    salary: 115000,
    salary_mode: 'Annual',
    benefits_json: JSON.stringify([
      { benefitName: 'Basic Life Insurance', coverage: '2x Annual', volume: 230000, status: 'Approved' },
      { benefitName: 'Extended Health Care', coverage: 'Couple', volume: 0, status: 'Enrolled' },
      { benefitName: 'Dental Care', coverage: 'Couple', volume: 0, status: 'Enrolled' }
    ]),
    dependents_json: JSON.stringify([
      { dependentName: 'Claire Campbell', relationship: 'Spouse', relationshipCode: 'SP', dob: '1985-09-17', covered: 'Y' }
    ]),
    raw_data: JSON.stringify({ division: 'Laboratory Management', province: 'ON', effectiveDate: '2021-02-01' })
  },
  {
    id: 'cen-demo-7',
    carrier: 'Manulife Financial',
    policy_number: 'ML-552910',
    certificate_number: '00203',
    employee_name: 'Sophia Patel',
    first_name: 'Sophia',
    last_name: 'Patel',
    account_id: 'acc-demo-2',
    account_name: 'Beacon BioTech Solutions',
    status: 'Active',
    salary: 88000,
    salary_mode: 'Annual',
    benefits_json: JSON.stringify([
      { benefitName: 'Basic Life Insurance', coverage: '2x Annual', volume: 176000, status: 'Approved' },
      { benefitName: 'Extended Health Care', coverage: 'Single', volume: 0, status: 'Enrolled' }
    ]),
    dependents_json: JSON.stringify([]),
    raw_data: JSON.stringify({ division: 'Research & Development', province: 'ON', effectiveDate: '2022-10-15' })
  },

  // Canada Life - Cascade Mountain Logistics
  {
    id: 'cen-demo-8',
    carrier: 'Canada Life',
    policy_number: 'CL-884102',
    certificate_number: '00301',
    employee_name: 'Robert Taylor',
    first_name: 'Robert',
    last_name: 'Taylor',
    account_id: 'acc-demo-3',
    account_name: 'Cascade Mountain Logistics',
    status: 'Active',
    salary: 128000,
    salary_mode: 'Annual',
    benefits_json: JSON.stringify([
      { benefitName: 'Basic Life Insurance', coverage: '2x Annual', volume: 256000, status: 'Approved' },
      { benefitName: 'Extended Health Care', coverage: 'Family', volume: 0, status: 'Enrolled' },
      { benefitName: 'Dental Care', coverage: 'Family', volume: 0, status: 'Enrolled' },
      { benefitName: 'Long Term Disability', coverage: '66.7% Monthly', volume: 7115, status: 'Approved' }
    ]),
    dependents_json: JSON.stringify([
      { dependentName: 'Jennifer Taylor', relationship: 'Spouse', relationshipCode: 'SP', dob: '1981-11-29', covered: 'Y' },
      { dependentName: 'Lucas Taylor', relationship: 'Son', relationshipCode: 'SN', dob: '2014-06-04', covered: 'Y' }
    ]),
    raw_data: JSON.stringify({ division: 'Executive Logistics', province: 'AB', effectiveDate: '2019-09-01' })
  },
  {
    id: 'cen-demo-9',
    carrier: 'Canada Life',
    policy_number: 'CL-884102',
    certificate_number: '00302',
    employee_name: 'Amanda White',
    first_name: 'Amanda',
    last_name: 'White',
    account_id: 'acc-demo-3',
    account_name: 'Cascade Mountain Logistics',
    status: 'Terminated',
    salary: 74000,
    salary_mode: 'Annual',
    benefits_json: JSON.stringify([
      { benefitName: 'Basic Life Insurance', coverage: '1x Annual', volume: 74000, status: 'Terminated' }
    ]),
    dependents_json: JSON.stringify([]),
    raw_data: JSON.stringify({ division: 'HR & Fleet Operations', province: 'AB', effectiveDate: '2021-05-01', terminationDate: '2026-08-31' })
  },
  {
    id: 'cen-demo-10',
    carrier: 'Canada Life',
    policy_number: 'CL-884102',
    certificate_number: '00303',
    employee_name: 'Jason Miller',
    first_name: 'Jason',
    last_name: 'Miller',
    account_id: 'acc-demo-3',
    account_name: 'Cascade Mountain Logistics',
    status: 'Active',
    salary: 82000,
    salary_mode: 'Annual',
    benefits_json: JSON.stringify([
      { benefitName: 'Basic Life Insurance', coverage: '2x Annual', volume: 164000, status: 'Approved' },
      { benefitName: 'Extended Health Care', coverage: 'Family', volume: 0, status: 'Enrolled' },
      { benefitName: 'Dental Care', coverage: 'Family', volume: 0, status: 'Enrolled' }
    ]),
    dependents_json: JSON.stringify([
      { dependentName: 'Samantha Miller', relationship: 'Spouse', relationshipCode: 'SP', dob: '1987-04-16', covered: 'Y' }
    ]),
    raw_data: JSON.stringify({ division: 'Warehouse Operations', province: 'AB', effectiveDate: '2022-07-12' })
  },

  // Pacific Blue Cross - Crestview Academy
  {
    id: 'cen-demo-11',
    carrier: 'Pacific Blue Cross',
    policy_number: 'PBC-449102',
    certificate_number: '00401',
    employee_name: 'Margaret Thornton',
    first_name: 'Margaret',
    last_name: 'Thornton',
    account_id: 'acc-demo-4',
    account_name: 'Crestview Academy',
    status: 'Active',
    salary: 148000,
    salary_mode: 'Annual',
    benefits_json: JSON.stringify([
      { benefitName: 'Basic Life Insurance', coverage: '2x Annual', volume: 296000, status: 'Approved' },
      { benefitName: 'Extended Health Care', coverage: 'Couple', volume: 0, status: 'Enrolled' },
      { benefitName: 'Dental Care', coverage: 'Couple', volume: 0, status: 'Enrolled' },
      { benefitName: 'Employee Assistance Program', coverage: 'Full Family EFAP', volume: 0, status: 'Enrolled' }
    ]),
    dependents_json: JSON.stringify([
      { dependentName: 'Edward Thornton', relationship: 'Spouse', relationshipCode: 'SP', dob: '1976-02-18', covered: 'Y' }
    ]),
    raw_data: JSON.stringify({ division: 'Faculty Leadership', province: 'BC', effectiveDate: '2018-09-01' })
  },
  {
    id: 'cen-demo-12',
    carrier: 'Pacific Blue Cross',
    policy_number: 'PBC-449102',
    certificate_number: '00402',
    employee_name: 'Brian Fraser',
    first_name: 'Brian',
    last_name: 'Fraser',
    account_id: 'acc-demo-4',
    account_name: 'Crestview Academy',
    status: 'Active',
    salary: 112000,
    salary_mode: 'Annual',
    benefits_json: JSON.stringify([
      { benefitName: 'Basic Life Insurance', coverage: '2x Annual', volume: 224000, status: 'Approved' },
      { benefitName: 'Extended Health Care', coverage: 'Family', volume: 0, status: 'Enrolled' },
      { benefitName: 'Dental Care', coverage: 'Family', volume: 0, status: 'Enrolled' }
    ]),
    dependents_json: JSON.stringify([
      { dependentName: 'Fiona Fraser', relationship: 'Spouse', relationshipCode: 'SP', dob: '1983-08-30', covered: 'Y' },
      { dependentName: 'Callum Fraser', relationship: 'Son', relationshipCode: 'SN', dob: '2017-01-14', covered: 'Y' }
    ]),
    raw_data: JSON.stringify({ division: 'Finance & Administration', province: 'BC', effectiveDate: '2020-01-15' })
  },
  {
    id: 'cen-demo-13',
    carrier: 'Pacific Blue Cross',
    policy_number: 'PBC-449102',
    certificate_number: '00403',
    employee_name: 'Claire Dubois',
    first_name: 'Claire',
    last_name: 'Dubois',
    account_id: 'acc-demo-4',
    account_name: 'Crestview Academy',
    status: 'Active',
    salary: 86000,
    salary_mode: 'Annual',
    benefits_json: JSON.stringify([
      { benefitName: 'Basic Life Insurance', coverage: '1.5x Annual', volume: 129000, status: 'Approved' },
      { benefitName: 'Extended Health Care', coverage: 'Single', volume: 0, status: 'Enrolled' },
      { benefitName: 'Dental Care', coverage: 'Single', volume: 0, status: 'Enrolled' }
    ]),
    dependents_json: JSON.stringify([]),
    raw_data: JSON.stringify({ division: 'Academic Faculty', province: 'BC', effectiveDate: '2021-09-01' })
  },

  // Manulife - Nova Dynamics Robotics
  {
    id: 'cen-demo-14',
    carrier: 'Manulife Financial',
    policy_number: 'ML-552910',
    certificate_number: '00501',
    employee_name: 'Henri Bouchard',
    first_name: 'Henri',
    last_name: 'Bouchard',
    account_id: 'acc-demo-7',
    account_name: 'Nova Dynamics Robotics',
    status: 'Active',
    salary: 132000,
    salary_mode: 'Annual',
    benefits_json: JSON.stringify([
      { benefitName: 'Basic Life Insurance', coverage: '2x Annual', volume: 264000, status: 'Approved' },
      { benefitName: 'Extended Health Care', coverage: 'Family', volume: 0, status: 'Enrolled' },
      { benefitName: 'Dental Care', coverage: 'Family', volume: 0, status: 'Enrolled' }
    ]),
    dependents_json: JSON.stringify([
      { dependentName: 'Camille Bouchard', relationship: 'Spouse', relationshipCode: 'SP', dob: '1980-03-24', covered: 'Y' }
    ]),
    raw_data: JSON.stringify({ division: 'Human Resources', province: 'QC', effectiveDate: '2019-11-01' })
  },
  {
    id: 'cen-demo-15',
    carrier: 'Manulife Financial',
    policy_number: 'ML-552910',
    certificate_number: '00502',
    employee_name: 'Julien Moreau',
    first_name: 'Julien',
    last_name: 'Moreau',
    account_id: 'acc-demo-7',
    account_name: 'Nova Dynamics Robotics',
    status: 'Terminated',
    salary: 118000,
    salary_mode: 'Annual',
    benefits_json: JSON.stringify([
      { benefitName: 'Basic Life Insurance', coverage: '1.5x Annual', volume: 177000, status: 'Terminated' }
    ]),
    dependents_json: JSON.stringify([]),
    raw_data: JSON.stringify({ division: 'Robotics Engineering', province: 'QC', effectiveDate: '2021-04-01', terminationDate: '2026-07-31' })
  },
  {
    id: 'cen-demo-16',
    carrier: 'Manulife Financial',
    policy_number: 'ML-552910',
    certificate_number: '00503',
    employee_name: 'Natalie Wong',
    first_name: 'Natalie',
    last_name: 'Wong',
    account_id: 'acc-demo-7',
    account_name: 'Nova Dynamics Robotics',
    status: 'Active',
    salary: 96000,
    salary_mode: 'Annual',
    benefits_json: JSON.stringify([
      { benefitName: 'Basic Life Insurance', coverage: '2x Annual', volume: 192000, status: 'Approved' },
      { benefitName: 'Extended Health Care', coverage: 'Family', volume: 0, status: 'Enrolled' },
      { benefitName: 'Dental Care', coverage: 'Family', volume: 0, status: 'Enrolled' }
    ]),
    dependents_json: JSON.stringify([
      { dependentName: 'David Wong', relationship: 'Spouse', relationshipCode: 'SP', dob: '1989-10-12', covered: 'Y' },
      { dependentName: 'Maya Wong', relationship: 'Daughter', relationshipCode: 'DT', dob: '2018-05-09', covered: 'Y' }
    ]),
    raw_data: JSON.stringify({ division: 'Automated Systems', province: 'QC', effectiveDate: '2022-09-01' })
  }
];

const DEMO_MEETINGS = [
  {
    id: 'mtg-demo-1',
    name: 'Annual Benefits Renewal Strategy',
    date_start: '2026-10-12 10:00:00',
    date_end: '2026-10-12 11:00:00',
    status: 'Planned',
    parent_id: 'acc-demo-1',
    parent_name: 'Apex Horizon Technologies',
    assigned_user_name: 'Alex Morgan',
    assigned_user_id: 'usr-demo-test'
  },
  {
    id: 'mtg-demo-2',
    name: 'Quarterly Claims Experience Review',
    date_start: '2026-09-18 14:00:00',
    date_end: '2026-09-18 15:00:00',
    status: 'Held',
    parent_id: 'acc-demo-2',
    parent_name: 'Beacon BioTech Solutions',
    assigned_user_name: 'Alex Morgan',
    assigned_user_id: 'usr-demo-test'
  },
  {
    id: 'mtg-demo-3',
    name: 'Wellness & EAP Program Rollout',
    date_start: '2026-10-20 11:30:00',
    date_end: '2026-10-20 12:30:00',
    status: 'Planned',
    parent_id: 'acc-demo-5',
    parent_name: 'Helios Clean Energy',
    assigned_user_name: 'Jane Doe',
    assigned_user_id: 'usr-demo-jdoe'
  },
  {
    id: 'mtg-demo-4',
    name: 'HSA & Spending Account Member Q&A',
    date_start: '2026-10-27 15:00:00',
    date_end: '2026-10-27 16:00:00',
    status: 'Planned',
    parent_id: 'acc-demo-3',
    parent_name: 'Cascade Mountain Logistics',
    assigned_user_name: 'Alex Morgan',
    assigned_user_id: 'usr-demo-test'
  },
  {
    id: 'mtg-demo-5',
    name: 'Underwriting Rate Review & Carrier Benchmarking',
    date_start: '2026-11-04 09:30:00',
    date_end: '2026-11-04 10:30:00',
    status: 'Planned',
    parent_id: 'acc-demo-7',
    parent_name: 'Nova Dynamics Robotics',
    assigned_user_name: 'Arthur Smith',
    assigned_user_id: 'usr-demo-asmith'
  },
  {
    id: 'mtg-demo-6',
    name: 'Executive Total Compensation Advisory',
    date_start: '2026-09-02 13:00:00',
    date_end: '2026-09-02 14:00:00',
    status: 'Held',
    parent_id: 'acc-demo-6',
    parent_name: 'Meridian Legal Group',
    assigned_user_name: 'Alex Morgan',
    assigned_user_id: 'usr-demo-test'
  },
  {
    id: 'mtg-demo-7',
    name: 'Group Retirement Plan Performance Review',
    date_start: '2026-11-12 14:00:00',
    date_end: '2026-11-12 15:00:00',
    status: 'Planned',
    parent_id: 'acc-demo-10',
    parent_name: 'Sterling Financial Advisors',
    assigned_user_name: 'Arthur Smith',
    assigned_user_id: 'usr-demo-asmith'
  },
  {
    id: 'mtg-demo-8',
    name: 'Mid-Year Utilization & Paramedical Claims Audit',
    date_start: '2026-10-29 10:30:00',
    date_end: '2026-10-29 11:30:00',
    status: 'Planned',
    parent_id: 'acc-demo-9',
    parent_name: 'Pinnacle Health Partners',
    assigned_user_name: 'Jane Doe',
    assigned_user_id: 'usr-demo-jdoe'
  }
];

const DEMO_REPORTS = [
  {
    id: 'rep-demo-1',
    name: 'Active Accounts by Industry',
    report_module: 'Accounts',
    assigned_user_name: 'Alex Morgan'
  },
  {
    id: 'rep-demo-2',
    name: 'Upcoming Group Benefits Renewals (90 Days)',
    report_module: 'Accounts',
    assigned_user_name: 'Alex Morgan'
  },
  {
    id: 'rep-demo-3',
    name: 'Quarterly Client Executive Reviews',
    report_module: 'Meetings',
    assigned_user_name: 'Alex Morgan'
  },
  {
    id: 'rep-demo-4',
    name: 'Contact Plan Member Short-term Liabilities',
    report_module: 'Contacts',
    assigned_user_name: 'Alex Morgan'
  },
  {
    id: 'rep-demo-5',
    name: 'Carrier Client Distribution & Coverage Summary',
    report_module: 'Accounts',
    assigned_user_name: 'Alex Morgan'
  }
];

const DEMO_USER_PREFERENCES = {
  theme: 'dark',
  corner_style: 'rounded',
  account_columns: ['name', 'industry', 'renewal_date', 'carrier_tpa', 'num_employees', 'shipping_address_city']
};

function seedDemoDatabase(executeFn, queryOneFn) {
  const now = new Date().toISOString();

  // Create tables in demo database
  executeFn(`
    CREATE TABLE IF NOT EXISTS app_config (
      key TEXT PRIMARY KEY,
      value TEXT,
      updated_at TEXT
    );

    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      user_name TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      first_name TEXT,
      last_name TEXT,
      email1 TEXT,
      status TEXT DEFAULT 'Active',
      is_admin INTEGER DEFAULT 1,
      created_at TEXT,
      updated_at TEXT,
      description TEXT
    );

    CREATE TABLE IF NOT EXISTS accounts (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      account_type TEXT,
      email1 TEXT,
      website TEXT,
      industry TEXT,
      description TEXT,
      shipping_address_city TEXT,
      shipping_address_state TEXT,
      renewal_date TEXT,
      carrier_tpa TEXT,
      num_employees TEXT,
      created_at TEXT,
      updated_at TEXT
    );

    CREATE TABLE IF NOT EXISTS contacts (
      id TEXT PRIMARY KEY,
      account_id TEXT,
      account_name TEXT,
      name TEXT NOT NULL,
      email TEXT,
      phone TEXT,
      role TEXT,
      status TEXT DEFAULT 'Active',
      notes TEXT,
      created_at TEXT,
      updated_at TEXT
    );

    CREATE TABLE IF NOT EXISTS meetings (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      date_start TEXT,
      date_end TEXT,
      status TEXT DEFAULT 'Planned',
      parent_id TEXT,
      parent_type TEXT DEFAULT 'Accounts',
      parent_name TEXT,
      assigned_user_name TEXT,
      assigned_user_id TEXT,
      created_at TEXT,
      updated_at TEXT
    );

    CREATE TABLE IF NOT EXISTS reports (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      report_module TEXT,
      date_modified TEXT,
      assigned_user_name TEXT
    );

    CREATE TABLE IF NOT EXISTS user_preferences (
      username TEXT PRIMARY KEY,
      data TEXT,
      updated_at TEXT
    );

    CREATE TABLE IF NOT EXISTS carriers (
      id TEXT PRIMARY KEY,
      carrier TEXT NOT NULL,
      description TEXT,
      clientIdentifier TEXT,
      clients TEXT,
      created_at TEXT,
      updated_at TEXT
    );

    CREATE TABLE IF NOT EXISTS census_records (
      id TEXT PRIMARY KEY,
      carrier TEXT NOT NULL,
      policy_number TEXT,
      certificate_number TEXT,
      employee_name TEXT,
      first_name TEXT,
      last_name TEXT,
      account_id TEXT,
      account_name TEXT,
      status TEXT,
      salary REAL,
      salary_mode TEXT,
      benefits_json TEXT,
      dependents_json TEXT,
      raw_data TEXT,
      created_at TEXT,
      updated_at TEXT
    );

    CREATE TABLE IF NOT EXISTS user_sessions (
      token TEXT PRIMARY KEY,
      username TEXT NOT NULL,
      name TEXT,
      created_at TEXT
    );
  `);

  // Migrate demo individuals to contacts table if needed
  try {
    const tableType = queryOneFn("SELECT type FROM sqlite_master WHERE name = 'individuals';");
    if (tableType && tableType.type === 'table') {
      executeFn(`INSERT OR IGNORE INTO contacts SELECT * FROM individuals;`);
      executeFn(`DROP TABLE individuals;`);
      executeFn(`CREATE VIEW IF NOT EXISTS individuals AS SELECT * FROM contacts;`);
      executeFn(`
        CREATE TRIGGER IF NOT EXISTS trg_ind_ins INSTEAD OF INSERT ON individuals
        BEGIN
          INSERT OR REPLACE INTO contacts (id, account_id, account_name, name, email, phone, role, status, notes, created_at, updated_at)
          VALUES (new.id, new.account_id, new.account_name, new.name, new.email, new.phone, new.role, new.status, new.notes, new.created_at, new.updated_at);
        END;
      `);
      executeFn(`
        CREATE TRIGGER IF NOT EXISTS trg_ind_upd INSTEAD OF UPDATE ON individuals
        BEGIN
          UPDATE contacts SET account_id=new.account_id, account_name=new.account_name, name=new.name, email=new.email, phone=new.phone, role=new.role, status=new.status, notes=new.notes, updated_at=new.updated_at WHERE id=old.id;
        END;
      `);
      executeFn(`
        CREATE TRIGGER IF NOT EXISTS trg_ind_del INSTEAD OF DELETE ON individuals
        BEGIN
          DELETE FROM contacts WHERE id=old.id;
        END;
      `);
    } else {
      executeFn(`CREATE VIEW IF NOT EXISTS individuals AS SELECT * FROM contacts;`);
    }
  } catch (_) {}

  // Ensure default app_config
  executeFn(`INSERT OR REPLACE INTO app_config (key, value, updated_at) VALUES ('backend_mode', 'sqlite', ${escapeSql(now)});`);

  // Check if accounts already exist
  const countRow = queryOneFn("SELECT COUNT(*) as count FROM accounts;");
  if (countRow && Number(countRow.count) > 0) {
    console.log(`[Demo Seed] Demo database already contains ${countRow.count} accounts. Ensuring test user exists.`);
    // Make sure test user is in users table
    executeFn(`
      INSERT OR REPLACE INTO users (id, user_name, password_hash, first_name, last_name, email1, status, is_admin, created_at, updated_at, description)
      VALUES ('usr-demo-test', 'test', ${escapeSql(hashPassword('test'))}, 'Alex', 'Morgan', 'test@demofinancial.llc', 'Active', 1, ${escapeSql(now)}, ${escapeSql(now)}, 'Lead Benefits Advisor & Portfolio Director');
    `);
    return;
  }

  console.log('[Demo Seed] Seeding demo database with comprehensive dummy data for interview showcase...');

  // 1. Seed Users
  for (const u of DEMO_USERS) {
    executeFn(`
      INSERT INTO users (id, user_name, password_hash, first_name, last_name, email1, status, is_admin, created_at, updated_at, description)
      VALUES (${escapeSql(u.id)}, ${escapeSql(u.user_name)}, ${escapeSql(u.password_hash)}, ${escapeSql(u.first_name)}, ${escapeSql(u.last_name)}, ${escapeSql(u.email1)}, ${escapeSql(u.status)}, ${u.is_admin}, ${escapeSql(now)}, ${escapeSql(now)}, ${escapeSql(u.description)});
    `);
  }

  // 2. Seed Accounts
  for (const a of DEMO_ACCOUNTS) {
    executeFn(`
      INSERT INTO accounts (id, name, account_type, email1, website, industry, description, shipping_address_city, shipping_address_state, renewal_date, carrier_tpa, num_employees, created_at, updated_at)
      VALUES (${escapeSql(a.id)}, ${escapeSql(a.name)}, ${escapeSql(a.account_type)}, ${escapeSql(a.email1)}, ${escapeSql(a.website)}, ${escapeSql(a.industry)}, ${escapeSql(a.description)}, ${escapeSql(a.shipping_address_city)}, ${escapeSql(a.shipping_address_state)}, ${escapeSql(a.renewal_date)}, ${escapeSql(a.carrier_tpa)}, ${escapeSql(a.num_employees)}, ${escapeSql(now)}, ${escapeSql(now)});
    `);
  }

  // 3. Seed Carriers
  for (const c of DEMO_CARRIERS) {
    executeFn(`
      INSERT INTO carriers (id, carrier, description, clientIdentifier, clients, created_at, updated_at)
      VALUES (${escapeSql(c.id)}, ${escapeSql(c.carrier)}, ${escapeSql(c.description)}, ${escapeSql(c.clientIdentifier)}, ${escapeSql(c.clients)}, ${escapeSql(now)}, ${escapeSql(now)});
    `);
  }

  // 4. Seed Contacts
  for (const ind of DEMO_INDIVIDUALS) {
    executeFn(`
      INSERT INTO contacts (id, account_id, account_name, name, email, phone, role, status, notes, created_at, updated_at)
      VALUES (${escapeSql(ind.id)}, ${escapeSql(ind.account_id)}, ${escapeSql(ind.account_name)}, ${escapeSql(ind.name)}, ${escapeSql(ind.email)}, ${escapeSql(ind.phone)}, ${escapeSql(ind.role)}, ${escapeSql(ind.status)}, ${escapeSql(ind.notes)}, ${escapeSql(now)}, ${escapeSql(now)});
    `);
  }

  // 5. Seed Census Records
  for (const cen of DEMO_CENSUS_RECORDS) {
    executeFn(`
      INSERT INTO census_records (id, carrier, policy_number, certificate_number, employee_name, first_name, last_name, account_id, account_name, status, salary, salary_mode, benefits_json, dependents_json, raw_data, created_at, updated_at)
      VALUES (${escapeSql(cen.id)}, ${escapeSql(cen.carrier)}, ${escapeSql(cen.policy_number)}, ${escapeSql(cen.certificate_number)}, ${escapeSql(cen.employee_name)}, ${escapeSql(cen.first_name)}, ${escapeSql(cen.last_name)}, ${escapeSql(cen.account_id)}, ${escapeSql(cen.account_name)}, ${escapeSql(cen.status)}, ${cen.salary}, ${escapeSql(cen.salary_mode)}, ${escapeSql(cen.benefits_json)}, ${escapeSql(cen.dependents_json)}, ${escapeSql(cen.raw_data)}, ${escapeSql(now)}, ${escapeSql(now)});
    `);
  }

  // 6. Seed Meetings
  for (const m of DEMO_MEETINGS) {
    executeFn(`
      INSERT INTO meetings (id, name, date_start, date_end, status, parent_id, parent_type, parent_name, assigned_user_name, assigned_user_id, created_at, updated_at)
      VALUES (${escapeSql(m.id)}, ${escapeSql(m.name)}, ${escapeSql(m.date_start)}, ${escapeSql(m.date_end)}, ${escapeSql(m.status)}, ${escapeSql(m.parent_id)}, 'Accounts', ${escapeSql(m.parent_name)}, ${escapeSql(m.assigned_user_name)}, ${escapeSql(m.assigned_user_id)}, ${escapeSql(now)}, ${escapeSql(now)});
    `);
  }

  // 7. Seed Reports
  for (const r of DEMO_REPORTS) {
    executeFn(`
      INSERT INTO reports (id, name, report_module, date_modified, assigned_user_name)
      VALUES (${escapeSql(r.id)}, ${escapeSql(r.name)}, ${escapeSql(r.report_module)}, ${escapeSql(now)}, ${escapeSql(r.assigned_user_name)});
    `);
  }

  // 8. Seed User Preferences
  executeFn(`
    INSERT OR REPLACE INTO user_preferences (username, data, updated_at)
    VALUES ('test', ${escapeSql(JSON.stringify(DEMO_USER_PREFERENCES))}, ${escapeSql(now)});
  `);

  console.log('[Demo Seed] ✓ Successfully seeded demo database with 12 accounts, 35 individuals, 16 census records, 5 carriers, 8 meetings, 5 reports, and test user.');
}

module.exports = {
  DEMO_USERS,
  DEMO_ACCOUNTS,
  DEMO_CARRIERS,
  DEMO_INDIVIDUALS,
  DEMO_CENSUS_RECORDS,
  DEMO_MEETINGS,
  DEMO_REPORTS,
  DEMO_USER_PREFERENCES,
  seedDemoDatabase,
  hashPassword,
  escapeSql
};
