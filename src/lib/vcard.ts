export interface VCardContact {
  name: string;
  email: string | null;
  phone: string | null;
  organization: string | null;
  photoBase64: string | null;
  photoMimeType: string | null;
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
    let photoBase64: string | null = null;
    let photoMimeType: string | null = null;

    for (const line of lines) {
      const upper = line.toUpperCase();

      if (upper.startsWith("FN:") || upper.startsWith("FN;")) {
        fn = extractValue(line);
      } else if (upper.startsWith("EMAIL") && !email) {
        email = extractValue(line);
      } else if (upper.startsWith("TEL") && !phone) {
        phone = extractValue(line);
      } else if (upper.startsWith("ORG:") || upper.startsWith("ORG;")) {
        org = extractValue(line).split(";")[0];
      } else if (upper.startsWith("PHOTO") && !photoBase64) {
        // Extract MIME type from params like PHOTO;ENCODING=b;TYPE=JPEG: or PHOTO;MEDIATYPE=image/jpeg;ENCODING=BASE64:
        const paramStr = line.substring(0, line.indexOf(":")).toUpperCase();
        if (paramStr.includes("JPEG") || paramStr.includes("JPG")) {
          photoMimeType = "image/jpeg";
        } else if (paramStr.includes("PNG")) {
          photoMimeType = "image/png";
        } else if (paramStr.includes("GIF")) {
          photoMimeType = "image/gif";
        } else {
          photoMimeType = "image/jpeg"; // default
        }
        photoBase64 = extractValue(line);
      }
    }

    if (fn) {
      contacts.push({ name: fn, email, phone, organization: org, photoBase64, photoMimeType });
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
