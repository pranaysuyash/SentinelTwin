/**
 * compliance-templates.ts
 *
 * Regulatory Compliance Reporting Suite & Policy-Driven Redaction Engine.
 * Implements GDPR (UK ICO, French CNIL Art. L251-1 CSI, German BfDI BDSG §4),
 * PCI DSS Section 9, and BIPA / HIPAA physical safeguards templates.
 */

export type ReportRedactionPolicy = {
  redactCameraIps?: boolean;
  redactGpsCoordinates?: boolean;
  redactPatrolRoutes?: boolean;
  maskVulnerabilities?: boolean;
};

export type ComplianceTemplateId =
  | "gdpr-uk-ico"
  | "gdpr-cnil"
  | "gdpr-bdsg"
  | "pci-dss-sec9"
  | "bipa-hipaa";

export type RegulatoryMandate = {
  authority: string;
  articleOrSection: string;
  keyRequirement: string;
  retentionLimitDays: number;
  mandatoryRedactions: (keyof ReportRedactionPolicy)[];
};

export type ReportStandardTemplateDefinition = {
  id: string;
  title: string;
  standardLabel: string;
  summary: string;
  audienceHint: string;
  focusAreas: string[];
  evidenceAnchors: string[];
  sections: { title: string; detail: string }[];
  regulatoryMandates?: RegulatoryMandate[];
};

export const STANDARD_TEMPLATE_DEFINITIONS: Record<string, ReportStandardTemplateDefinition> = {
  // ─── Base Templates ─────────────────────────────────────────────────────────
  "general-audit": {
    id: "general-audit",
    title: "General Audit",
    standardLabel: "IEC 62676-4:2025",
    summary: "Default comprehensive security audit narrative.",
    audienceHint: "General-purpose security review",
    focusAreas: ["coverage", "zones"],
    evidenceAnchors: ["coverage-analysis", "zone-analysis"],
    sections: [
      { title: "Overview", detail: "Scene overview" },
      { title: "Coverage Analysis", detail: "Coverage metrics" },
      { title: "Zone Requirements", detail: "Zone-level requirements" },
      { title: "Conclusions", detail: "Findings" },
    ],
  },
  "installer-proposal": {
    id: "installer-proposal",
    title: "Installer Proposal",
    standardLabel: "IEC 62676-4:2025",
    summary: "Install-focused recommendations and billable scope.",
    audienceHint: "Security system integrators and installation contractors",
    focusAreas: ["camera-placement", "mounting-heights", "hardware-schedule"],
    evidenceAnchors: ["camera-analysis", "recommendations"],
    sections: [
      { title: "Scope of Work", detail: "Hardware placement schedule" },
      { title: "Camera Schedule", detail: "Mounting and lens specification" },
      { title: "Coverage Acceptance", detail: "Verification criteria" },
    ],
  },
  "insurer-brief": {
    id: "insurer-brief",
    title: "Insurer Brief",
    standardLabel: "Commercial Underwriting Risk Delta",
    summary: "Risk and mitigation delta summary for underwriting.",
    audienceHint: "Insurance underwriters and commercial property risk assessors",
    focusAreas: ["risk-reduction", "vulnerability-mitigation", "loss-prevention"],
    evidenceAnchors: ["executive-summary", "zone-analysis", "issues"],
    sections: [
      { title: "Underwriting Summary", detail: "Risk exposure posture" },
      { title: "Critical Asset Coverage", detail: "High-risk zone security" },
      { title: "Mitigation Schedule", detail: "Prioritized improvements" },
    ],
  },
  "privacy-review": {
    id: "privacy-review",
    title: "Privacy Review",
    standardLabel: "Privacy Governance Framework",
    summary: "Privacy-governance framing with controlled evidence.",
    audienceHint: "Privacy officers, legal counsel, works councils",
    focusAreas: ["privacy-zones", "masking-verification", "retention"],
    evidenceAnchors: ["privacy-masking", "zone-analysis"],
    sections: [
      { title: "Privacy Scope", detail: "Surveillance boundary analysis" },
      { title: "Masking Verification", detail: "Exclusion zone auditing" },
      { title: "Governance Compliance", detail: "Data protection safeguards" },
    ],
  },
  "oodpcvs-audit": {
    id: "oodpcvs-audit",
    title: "OODPCVS Audit",
    standardLabel: "IEC 62676-4:2025",
    summary: "Full OODPCVS assessment against IEC 62676-4:2025",
    audienceHint: "Regulatory and compliance audiences",
    focusAreas: ["coverage", "zones", "oodpcvs"],
    evidenceAnchors: ["zone-analysis", "camera-analysis"],
    sections: [
      { title: "Overview", detail: "Scene overview and scope" },
      { title: "Scope", detail: "Assessment scope" },
      { title: "Normative References", detail: "IEC 62676-4:2025" },
      { title: "OODPCVS Assessment", detail: "OODPCVS quality levels" },
      { title: "Coverage Analysis", detail: "Coverage metrics per camera and zone" },
      { title: "Zone Requirements", detail: "Zone-level quality requirements" },
      { title: "Conclusions", detail: "Findings and recommendations" },
    ],
  },
  "dori-audit": {
    id: "dori-audit",
    title: "DORI Audit",
    standardLabel: "IEC 62676-4:2014 (DORI)",
    summary: "DORI assessment for legacy compliance",
    audienceHint: "Legacy system audits and upgrade planning",
    focusAreas: ["dori", "coverage", "zones"],
    evidenceAnchors: ["dori-assessment", "zone-analysis"],
    sections: [
      { title: "Overview", detail: "DORI scene overview" },
      { title: "DORI Assessment", detail: "DORI quality levels per camera" },
      { title: "Coverage Analysis", detail: "Coverage metrics" },
      { title: "Zone Requirements", detail: "Zone-level DORI requirements" },
      { title: "Conclusions", detail: "Summary" },
    ],
  },

  // ─── Regulatory Compliance Templates ────────────────────────────────────────
  "gdpr-uk-ico": {
    id: "gdpr-uk-ico",
    title: "GDPR (UK ICO DPA Guidance)",
    standardLabel: "UK Data Protection Act 2018 / UK GDPR Art. 35 DPIA",
    summary: "Surveillance Data Protection Impact Assessment (DPIA) & Purpose Limitation Audit for UK ICO compliance.",
    audienceHint: "Data Protection Officers (DPOs), UK ICO auditors, legal compliance teams.",
    focusAreas: ["dpia", "purpose-limitation", "data-minimization", "retention"],
    evidenceAnchors: ["dpia-assessment", "camera-analysis", "privacy-masking"],
    sections: [
      { title: "DPIA Necessity & Proportionality", detail: "Evaluation of surveillance necessity under UK GDPR Art. 35 and ICO Video Surveillance Guidance." },
      { title: "Lawful Basis & Purpose Limitation", detail: "Verification of legitimate interest balancing (Art. 6(1)(f)) and strict prohibition of scope creep." },
      { title: "Data Minimization & Privacy Masking", detail: "Assessment of camera field-of-view (FoV) clipping and privacy zone coverage in public/employee areas." },
      { title: "Retention & Subject Access Readiness", detail: "Verification of 30-day routine deletion cycle and SAR video redaction capabilities." },
    ],
    regulatoryMandates: [
      {
        authority: "UK Information Commissioner's Office (ICO)",
        articleOrSection: "UK GDPR Art. 35 / DPA 2018 Sec. 64",
        keyRequirement: "Mandatory DPIA prior to systematic monitoring of publicly accessible areas; clear signage and purpose specification required.",
        retentionLimitDays: 30,
        mandatoryRedactions: ["redactCameraIps", "redactPatrolRoutes"],
      },
    ],
  },
  "gdpr-cnil": {
    id: "gdpr-cnil",
    title: "GDPR (French CNIL Art. L251-1 CSI)",
    standardLabel: "Code de la sécurité intérieure (CSI) Art. L251-1 / CNIL Video Guidance",
    summary: "French regulatory compliance audit for video protection systems in public spaces and workplaces.",
    audienceHint: "Prefecture authorization authorities, CNIL inspectors, French works councils (CSE).",
    focusAreas: ["prefecture-authorization", "public-space-masking", "employee-privacy", "csi-l251"],
    evidenceAnchors: ["prefecture-filing", "privacy-masking", "camera-analysis"],
    sections: [
      { title: "Prefecture Authorization Compliance", detail: "Verification of formal filing requirements under CSI Art. L251-1 to L251-8 for cameras viewing spaces open to the public." },
      { title: "Strict Public Street Masking", detail: "Validation that cameras at entrances/exits strictly mask public sidewalks, roads, and neighboring private properties." },
      { title: "Employee Workplace Protection", detail: "Verification under CNIL workplace monitoring rules that cameras do not continuously film employee workstations or rest areas." },
      { title: "Information Panels & Retention", detail: "Audit of mandatory CNIL information signage placement and strict adherence to 1-month maximum retention limit." },
    ],
    regulatoryMandates: [
      {
        authority: "Commission Nationale de l'Informatique et des Libertés (CNIL)",
        articleOrSection: "Code de la sécurité intérieure Art. L251-1 & L254-1",
        keyRequirement: "Formal prefecture authorization required before installation; strict 30-day maximum retention; absolute prohibition on monitoring employee workstations.",
        retentionLimitDays: 30,
        mandatoryRedactions: ["redactCameraIps", "redactPatrolRoutes"],
      },
    ],
  },
  "gdpr-bdsg": {
    id: "gdpr-bdsg",
    title: "GDPR (German BfDI BDSG §4)",
    standardLabel: "Bundesdatenschutzgesetz (BDSG) §4 / BetrVG §87(1) No. 6",
    summary: "German Federal Data Protection Act compliance audit with proportionality balancing and works council co-determination.",
    audienceHint: "BfDI / State Data Protection Authorities, Works Councils (Betriebsrat), Corporate Privacy Officers.",
    focusAreas: ["proportionality-test", "works-council", "interessenabwaegung", "erasure-rules"],
    evidenceAnchors: ["interessenabwaegung", "privacy-masking", "retention-audit"],
    sections: [
      { title: "Erforderlichkeit & Verhältnismäßigkeit", detail: "Strict proportionality test under BDSG §4(1): verifying that video monitoring is the least intrusive effective measure." },
      { title: "Interessenabwägung (Balancing of Interests)", detail: "Formal documentation of data controller security interests vs. data subject fundamental rights and freedoms under BDSG §4(1) No. 3." },
      { title: "Works Council Co-Determination (BetrVG §87)", detail: "Technical verification that technical behavior monitors comply with works council agreements (Betriebsvereinbarung) under BetrVG §87(1) No. 6." },
      { title: "Strict Erasure & Access Logging", detail: "Audit of 48-72 hour routine deletion cycle and immutable audit logging of any manual footage access." },
    ],
    regulatoryMandates: [
      {
        authority: "Bundesbeauftragter für den Datenschutz und die Informationsfreiheit (BfDI)",
        articleOrSection: "BDSG §4 / BetrVG §87(1) No. 6",
        keyRequirement: "Video surveillance of publicly accessible areas is only permitted if necessary to protect legitimate interests and not overridden by data subject rights; works council co-determination mandatory for employee spaces.",
        retentionLimitDays: 3,
        mandatoryRedactions: ["redactCameraIps", "redactPatrolRoutes"],
      },
    ],
  },
  "pci-dss-sec9": {
    id: "pci-dss-sec9",
    title: "PCI DSS Section 9 (Physical Security)",
    standardLabel: "PCI DSS v4.0 Requirement 9.1 / 9.1.1",
    summary: "Payment Card Industry Data Security Standard physical access and video surveillance compliance report.",
    audienceHint: "Qualified Security Assessors (QSAs), PCI Compliance Managers, Data Center Directors.",
    focusAreas: ["cde-entry-monitoring", "server-room-coverage", "90-day-retention", "tamper-detection"],
    evidenceAnchors: ["cde-coverage", "camera-analysis", "retention-audit"],
    sections: [
      { title: "CDE Physical Entry Control Monitoring", detail: "Verification under Requirement 9.1 that all physical access points to the Cardholder Data Environment (CDE) have continuous camera coverage." },
      { title: "Sensitive Area & Server Rack Monitoring", detail: "Audit under Requirement 9.1.1 confirming unblinded observation of individual physical access to server rooms, wiring closets, and data centers." },
      { title: "90-Day Retention & Recording Continuity", detail: "Validation under Requirement 9.1.1.2 that storage architecture supports at least 90 days of continuous video/access log archiving." },
      { title: "Tamper Detection & Operational Verifications", detail: "Verification under Requirement 9.1.1.1 that cameras are monitored for tampering, signal loss, or misalignment." },
    ],
    regulatoryMandates: [
      {
        authority: "PCI Security Standards Council (PCI SSC)",
        articleOrSection: "PCI DSS v4.0 Requirement 9.1.1 / 9.1.1.2",
        keyRequirement: "Use video cameras and/or access control mechanisms to monitor individual physical access to sensitive areas; store footage and logs for at least 90 days.",
        retentionLimitDays: 90,
        mandatoryRedactions: ["maskVulnerabilities"],
      },
    ],
  },
  "bipa-hipaa": {
    id: "bipa-hipaa",
    title: "BIPA / HIPAA Safeguards",
    standardLabel: "Illinois BIPA 740 ILCS 14 / HIPAA 45 CFR § 164.310",
    summary: "Biometric Information Privacy Act & HIPAA Physical Safeguards audit for healthcare and high-privacy environments.",
    audienceHint: "Healthcare Compliance Officers, HIPAA Privacy Officers, Risk Management Counsel.",
    focusAreas: ["biometric-consent", "phi-masking", "physical-safeguards", "access-control"],
    evidenceAnchors: ["phi-privacy-zones", "biometric-audit", "camera-analysis"],
    sections: [
      { title: "Biometric Privacy & Facial Recognition Audit", detail: "Verification under BIPA (740 ILCS 14/15) that facial recognition and biometric identification analytics are either disabled or supported by written consent schedules." },
      { title: "HIPAA Physical Safeguards (45 CFR § 164.310)", detail: "Audit of facility access controls, workstation security, and device media controls in patient care environments." },
      { title: "PHI Visual Masking & Exam Room Exclusion", detail: "Verification that camera viewing angles strictly exclude patient treatment areas, exam tables, and medical monitor screens displaying Protected Health Information (PHI)." },
      { title: "Public Corridor & Perimeter Surveillance", detail: "Validation of security coverage in public access corridors and exterior perimeters without violating healthcare privacy boundaries." },
    ],
    regulatoryMandates: [
      {
        authority: "HHS Office for Civil Rights (OCR) / IL State Attorney General",
        articleOrSection: "HIPAA 45 CFR § 164.310 / BIPA 740 ILCS 14/15",
        keyRequirement: "Physical safeguards must prevent unauthorized visual access to PHI; biometric identifier capture requires prior written consent and public retention schedules.",
        retentionLimitDays: 30,
        mandatoryRedactions: ["redactCameraIps", "redactGpsCoordinates", "maskVulnerabilities"],
      },
    ],
  },
};

export function isComplianceTemplateId(id: string): id is ComplianceTemplateId {
  return id in STANDARD_TEMPLATE_DEFINITIONS && ["gdpr-uk-ico", "gdpr-cnil", "gdpr-bdsg", "pci-dss-sec9", "bipa-hipaa"].includes(id);
}

export function getReportStandardTemplateProfile(id: string): ReportStandardTemplateDefinition {
  return STANDARD_TEMPLATE_DEFINITIONS[id] ?? STANDARD_TEMPLATE_DEFINITIONS["general-audit"];
}

export function getAllStandardTemplates(): ReportStandardTemplateDefinition[] {
  return Object.values(STANDARD_TEMPLATE_DEFINITIONS);
}

export function applyPolicyRedaction<T extends Record<string, any>>(reportInput: T, policy?: ReportRedactionPolicy): T {
  const report: any = reportInput;
  if (
    !policy ||
    (!policy.redactCameraIps &&
      !policy.redactGpsCoordinates &&
      !policy.redactPatrolRoutes &&
      !policy.maskVulnerabilities)
  ) {
    return {
      ...report,
      redactionsApplied: report.redactionsApplied || [],
    } as T;
  }

  const redactionsApplied: string[] = [...(report.redactionsApplied || [])];
  if (policy.redactCameraIps && !redactionsApplied.includes("Camera IPs Redacted")) {
    redactionsApplied.push("Camera IPs Redacted");
  }
  if (policy.redactGpsCoordinates && !redactionsApplied.includes("GPS Coordinates Redacted")) {
    redactionsApplied.push("GPS Coordinates Redacted");
  }
  if (policy.redactPatrolRoutes && !redactionsApplied.includes("Patrol Routes Redacted")) {
    redactionsApplied.push("Patrol Routes Redacted");
  }
  if (policy.maskVulnerabilities && !redactionsApplied.includes("Vulnerabilities Masked")) {
    redactionsApplied.push("Vulnerabilities Masked");
  }

  const res: any = JSON.parse(JSON.stringify(report));
  res.redactionsApplied = redactionsApplied;
  if (!res.options) res.options = {};
  res.options.redactionPolicy = { ...policy };

  const ipv4Regex = /\b(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\b/g;
  const ipv6Regex = /\b(?:[A-F0-9]{1,4}:){7}[A-F0-9]{1,4}\b/gi;
  const gpsRegex = /[-+]?([1-8]?\d(\.\d+)?|90(\.0+)?),\s*[-+]?(180(\.0+)?|((1[0-7]\d)|([1-9]?\d))(\.\d+)?)/g;

  const sanitizeString = (str?: string): string | undefined => {
    if (!str || typeof str !== "string") return str;
    let out = str;
    if (policy.redactCameraIps) {
      out = out.replace(ipv4Regex, "[IP REDACTED]").replace(ipv6Regex, "[IP REDACTED]");
    }
    if (policy.redactGpsCoordinates) {
      out = out.replace(gpsRegex, "[GPS REDACTED]");
    }
    if (policy.redactPatrolRoutes) {
      if (out.toLowerCase().includes("patrol") || out.toLowerCase().includes("route")) {
        out = "[PATROL ROUTE REDACTED FOR SECURITY]";
      }
    }
    return out;
  };

  const sanitizeObjectStrings = (obj: any) => {
    if (!obj || typeof obj !== "object") return;
    for (const key of Object.keys(obj)) {
      const val = obj[key];
      if (typeof val === "string") {
        obj[key] = sanitizeString(val);
      } else if (typeof val === "object" && val !== null) {
        sanitizeObjectStrings(val);
      }
    }
  };

  if (Array.isArray(res.cameras)) {
    res.cameras = res.cameras.map((cam: any) => {
      const c = { ...cam };
      if (policy.redactCameraIps) {
        if (c.ipAddress || c.ip) c.ipAddress = "[REDACTED]";
        if (c.metadata?.ipAddress) c.metadata.ipAddress = "[REDACTED]";
        if (c.label) c.label = sanitizeString(c.label);
      }
      return c;
    });
  }

  if (Array.isArray(res.zones)) {
    res.zones = res.zones.map((zone: any) => {
      const z = { ...zone };
      if (policy.redactGpsCoordinates && z.coordinates) {
        z.coordinates = "[GPS REDACTED]";
      }
      if (z.label) z.label = sanitizeString(z.label);
      return z;
    });
  }

  if (policy.redactPatrolRoutes) {
    if (Array.isArray(res.evidenceLedger)) {
      res.evidenceLedger = res.evidenceLedger.map((ev: any) => {
        const e = { ...ev };
        if (e.title) e.title = sanitizeString(e.title);
        if (e.description) e.description = sanitizeString(e.description);
        if (e.details) e.details = sanitizeString(e.details);
        return e;
      });
    }
  }

  if (res.title) res.title = sanitizeString(res.title);
  if (res.summary) res.summary = sanitizeString(res.summary);
  if (res.audienceFraming) res.audienceFraming = sanitizeString(res.audienceFraming);
  if (res.sceneName) res.sceneName = sanitizeString(res.sceneName);

  if (res.assumptions) sanitizeObjectStrings(res.assumptions);
  if (res.provenance) sanitizeObjectStrings(res.provenance);

  if (policy.maskVulnerabilities) {
    if (Array.isArray(res.issues)) {
      res.issues = res.issues.map((iss: any) => {
        if (
          iss.severity === "critical" ||
          iss.severity === "high" ||
          iss.category === "blindspot" ||
          iss.category === "quality_fail"
        ) {
          return {
            ...iss,
            description: "[MASKED VULNERABILITY: Security sensitive gap - see internal audit log]",
            recommendation: "[MASKED - INTERNAL ONLY]",
          };
        }
        return iss;
      });
    }
    if (Array.isArray(res.recommendations)) {
      res.recommendations = res.recommendations.map((rec: any) => {
        if (!rec.verified || rec.costCategory === "high") {
          return {
            ...rec,
            description: "[MASKED RECOMMENDATION: See internal security engineering deck]",
          };
        }
        return rec;
      });
    }
    if (res.redundancyMatrix && Array.isArray(res.redundancyMatrix.vulnerableZones)) {
      res.redundancyMatrix.vulnerableZones = res.redundancyMatrix.vulnerableZones.map((vz: any) => ({
        ...vz,
        label: "[MASKED FOR EXTERNAL DISTRIBUTION]",
        reason: "[MASKED]",
      }));
    }
    if (res.novelAlgorithms) {
      if (Array.isArray(res.novelAlgorithms.blindRegions)) {
        res.novelAlgorithms.blindRegions = [];
      }
      if (res.novelAlgorithms.blindSpotFingerprint) {
        res.novelAlgorithms.blindSpotFingerprint = {
          ...res.novelAlgorithms.blindSpotFingerprint,
          signature: "[MASKED SIGNATURE]",
          regions: [],
          fingerprint: "masked",
        };
      }
    }
  }

  if (Array.isArray(res.zoneChanges)) {
    res.zoneChanges = res.zoneChanges.map((zc: any) => ({
      ...zc,
      zoneLabel: sanitizeString(zc.zoneLabel),
    }));
  }
  if (res.before && typeof res.before === "object") {
    res.before = applyPolicyRedaction(res.before, policy);
  }
  if (res.after && typeof res.after === "object") {
    res.after = applyPolicyRedaction(res.after, policy);
  }

  return res as T;
}
