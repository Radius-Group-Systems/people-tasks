export interface VCardContact {
  name: string;
  email: string | null;
  phone: string | null;
  organization: string | null;
}

export function parseVCards(vcfText: string): VCardContact[] {
  const contacts: VCardContact[] = [];
  const cards = vcfText.split("BEGIN:VCARD");

  for (const card of cards) {
    if (!card.trim()) continue;

    const lines = unfoldLines(card);

    let fn = "";
    let email: string | null = null;
    let phone: string | null = null;
    let org: string | null = null;

    for (const line of lines) {
      const upper = line.toUpperCase();

      if (upper.startsWith("FN:") || upper.startsWith("FN;")) {
        fn = extractValue(line);
      } else if (upper.startsWith("EMAIL") && !email) {
        email = extractValue(line);
      } else if (upper.startsWith("TEL") && !phone) {
        phone = extractValue(line);
      } else if (upper.startsWith("ORG:") || upper.startsWith("ORG;")) {
        org = extractValue(line).split(";")[0]; // ORG can have sub-units
      }
    }

    if (fn) {
      contacts.push({ name: fn, email, phone, organization: org });
    }
  }

  return contacts;
}

// VCard spec: long lines are folded with a leading space/tab on continuation lines
function unfoldLines(text: string): string[] {
  return text.replace(/\r\n[ \t]/g, "").replace(/\n[ \t]/g, "").split(/\r?\n/);
}

function extractValue(line: string): string {
  // Handle lines like "EMAIL;type=INTERNET;type=HOME:foo@bar.com"
  const colonIdx = line.indexOf(":");
  if (colonIdx === -1) return "";
  return line.slice(colonIdx + 1).trim();
}
