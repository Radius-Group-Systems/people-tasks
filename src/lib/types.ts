export interface TalkingPoint {
  id: string;
  text: string;
  done: boolean;
}

export interface Person {
  id: number;
  name: string;
  email: string | null;
  phone: string | null;
  slack_handle: string | null;
  organization: string | null;
  photo_url: string | null;
  notes: string | null;
  next_meeting_at: string | null;
  prep_notes: string | null;
  talking_points: TalkingPoint[];
  created_at: string;
  updated_at: string;
  // Computed fields (from joins)
  open_items_count?: number;
  waiting_on_count?: number;
  in_progress_count?: number;
  done_count?: number;
  last_encounter_at?: string | null;
  encounter_count?: number;
}

export interface EncounterFolder {
  id: number;
  name: string;
  color: string;
  parent_id: number | null;
  created_at: string;
}

export interface EmailAddress {
  name: string;
  address: string;
}

export interface EmailAttachment {
  name: string;
  content_type: string;
  size: number;
  path: string; // relative path in public/uploads/emails/
}

export interface Encounter {
  id: number;
  title: string;
  encounter_type: string;
  occurred_at: string;
  summary: string | null;
  detailed_summary: MeetingSummary | null;
  raw_transcript: string | null;
  source: string;
  source_file_path: string | null;
  folder_id: number | null;
  notes: string | null;
  email_message_id: string | null;
  email_thread_id: string | null;
  email_from: EmailAddress | null;
  email_to: EmailAddress[] | null;
  email_cc: EmailAddress[] | null;
  email_attachments: EmailAttachment[];
  project_id: number | null;
  created_at: string;
  // Joined
  participants?: Person[];
  action_items?: ActionItem[];
  folder_name?: string;
  folder_color?: string;
  project_name?: string;
}

export interface MeetingSummary {
  title: string;
  attendees: string[];
  topics: {
    topic: string;
    conclusion: string;
    next_steps: string[];
    discussion_points: {
      viewpoint: string;
      supporting_detail: string | null;
    }[];
  }[];
  overall_summary: string;
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

export interface ChecklistItem {
  id: string;
  text: string;
  done: boolean;
}

export interface ActionItem {
  id: number;
  title: string;
  description: string | null;
  owner_type: "me" | "them";
  person_id: number | null;
  source_person_id: number | null;
  encounter_id: number | null;
  project_id: number | null;
  milestone_id: number | null;
  status: "open" | "in_progress" | "done" | "snoozed" | "cancelled";
  priority: "low" | "normal" | "high" | "urgent";
  due_at: string | null;
  due_trigger: string | null;
  snoozed_until: string | null;
  completed_at: string | null;
  sent_via: string | null;
  sent_at: string | null;
  checklist: ChecklistItem[];
  links: ActionItemLink[];
  attachments: ActionItemAttachment[];
  created_at: string;
  updated_at: string;
  // Joined
  person_name?: string;
  source_person_name?: string;
  encounter_title?: string;
  next_meeting_date?: string | null;
  project_name?: string;
  milestone_title?: string;
}

export interface Project {
  id: number;
  name: string;
  description: string | null;
  status: "active" | "on_hold" | "completed" | "archived";
  color: string;
  start_date: string | null;
  target_date: string | null;
  created_at: string;
  updated_at: string;
  // Computed / joined
  members?: ProjectMember[];
  task_count?: number;
  done_count?: number;
  open_count?: number;
  milestone_count?: number;
  next_milestone?: string | null;
}

export interface ProjectMember {
  project_id: number;
  person_id: number;
  role: "lead" | "member" | "stakeholder" | "client";
  created_at: string;
  // Joined
  person_name?: string;
  person_photo_url?: string | null;
}

export interface Milestone {
  id: number;
  project_id: number;
  title: string;
  description: string | null;
  target_date: string | null;
  status: "upcoming" | "in_progress" | "completed";
  sort_order: number;
  created_at: string;
  // Computed
  task_count?: number;
  done_count?: number;
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
