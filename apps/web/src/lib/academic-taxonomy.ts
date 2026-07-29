export const COUNTRY_CODES = (
  "AD AE AF AG AI AL AM AO AQ AR AS AT AU AW AX AZ BA BB BD BE BF BG BH BI BJ BL BM BN BO BQ BR BS BT BV BW BY BZ CA CC CD CF CG CH CI CK CL CM CN CO CR CU CV CW CX CY CZ DE DJ DK DM DO DZ EC EE EG EH ER ES ET FI FJ FK FM FO FR GA GB GD GE GF GG GH GI GL GM GN GP GQ GR GS GT GU GW GY HK HM HN HR HT HU ID IE IL IM IN IO IQ IR IS IT JE JM JO JP KE KG KH KI KM KN KP KR KW KY KZ LA LB LC LI LK LR LS LT LU LV LY MA MC MD ME MF MG MH MK ML MM MN MO MP MQ MR MS MT MU MV MW MX MY MZ NA NC NE NF NG NI NL NO NP NR NU NZ OM PA PE PF PG PH PK PL PM PN PR PS PT PW PY QA RE RO RS RU RW SA SB SC SD SE SG SH SI SJ SK SL SM SN SO SR SS ST SV SX SY SZ TC TD TF TG TH TJ TK TL TM TN TO TR TT TV TW TZ UA UG UM US UY UZ VA VC VE VG VI VN VU WF WS YE YT ZA ZM ZW"
).split(" ");

const regionNames = new Intl.DisplayNames(["en"], { type: "region" });

export const countryOptions = COUNTRY_CODES.map((code) => ({
  value: code,
  label: regionNames.of(code) || code
})).sort((a, b) => a.label.localeCompare(b.label));

export const academicFieldGroups = [
  { value: "natural_sciences", label: "Natural Sciences" },
  { value: "engineering_technology", label: "Engineering and Technology" },
  { value: "medical_health_sciences", label: "Medical and Health Sciences" },
  { value: "agricultural_veterinary_sciences", label: "Agricultural and Veterinary Sciences" },
  { value: "social_sciences", label: "Social Sciences" },
  { value: "humanities_arts", label: "Humanities and the Arts" },
  { value: "interdisciplinary_other", label: "Interdisciplinary and Other" }
] as const;

export const academicFieldsByGroup: Record<string, string[]> = {
  natural_sciences: ["Biological Sciences", "Chemical Sciences", "Computer and Information Sciences", "Earth and Environmental Sciences", "Mathematics", "Physical Sciences"],
  engineering_technology: ["Chemical Engineering", "Civil Engineering", "Electrical and Electronic Engineering", "Environmental Engineering", "Industrial Engineering", "Materials Engineering", "Mechanical Engineering"],
  medical_health_sciences: ["Clinical Medicine", "Health Sciences", "Medical Biotechnology", "Nursing", "Pharmacy", "Public Health"],
  agricultural_veterinary_sciences: ["Agricultural Biotechnology", "Agriculture", "Animal and Dairy Science", "Fisheries", "Forestry", "Veterinary Science"],
  social_sciences: ["Business and Management", "Economics", "Education", "Geography", "Law", "Political Science", "Psychology", "Sociology"],
  humanities_arts: ["Archaeology", "Arts", "History", "Languages and Literature", "Media and Communication", "Philosophy", "Religion and Theology"],
  interdisciplinary_other: ["Data Science", "Development Studies", "Environmental Studies", "Gender Studies", "Interdisciplinary Research", "Science and Technology Studies"]
};

const countryCodeSet = new Set(COUNTRY_CODES);
const fieldGroupSet = new Set(academicFieldGroups.map((group) => group.value));

export function normalizeCountryCode(value: string) {
  const code = value.trim().toUpperCase();
  return countryCodeSet.has(code) ? code : "";
}

export function normalizeAcademicFieldGroup(value: string) {
  const group = value.trim();
  return fieldGroupSet.has(group as (typeof academicFieldGroups)[number]["value"]) ? group : "";
}

export function normalizeAcademicField(value: string) {
  return value.trim().replace(/\s+/g, " ").slice(0, 120);
}

export function academicFieldKey(group: string, value: string) {
  const normalizedGroup = normalizeAcademicFieldGroup(group);
  const normalizedField = normalizeAcademicField(value)
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 140);
  return normalizedGroup && normalizedField ? `${normalizedGroup}:${normalizedField}` : "";
}
