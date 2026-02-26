export interface Person {
  id: number;
  name: string;
  email: string | null;
  phone: string | null;
  slack_handle: string | null;
  organization: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  // Computed fields (from joins)
  open_items_count?: number;
  waiting_on_count?: number;
}

export interface Encounter {
  id: number;
  title: string;
  encounter_type: string;
  occurred_at: string;
  summary: string | null;
  raw_transcript: string | null;
  source: string;
  source_file_path: string | null;
  created_at: string;
  // Joined
  participants?: Person[];
}

export interface ActionItemLink {
  url: string;
  label?: string;
}

export interface ActionItemAttachment {
  name: string;
  url: string;
  type?: string; // mime type
  size?: number; // bytes
}

export interface ActionItem {
  id: number;
  title: string;
  description: string | null;
  owner_type: "me" | "them";
  person_id: number | null;
  source_person_id: number | null;
  encounter_id: number | null;
  status: "open" | "in_progress" | "done" | "snoozed" | "cancelled";
  priority: "low" | "normal" | "high" | "urgent";
  due_at: string | null;
  due_trigger: string | null;
  snoozed_until: string | null;
  completed_at: string | null;
  sent_via: string | null;
  sent_at: string | null;
  links: ActionItemLink[];
  attachments: ActionItemAttachment[];
  created_at: string;
  updated_at: string;
  // Joined
  person_name?: string;
  source_person_name?: string;
  encounter_title?: string;
}

export interface DelegationChain {
  id: number;
  action_item_id: number;
  from_person_id: number | null;
  to_person_id: number | null;
  via_person_id: number | null;
  status: "pending" | "relayed" | "completed";
  created_at: string;
}
