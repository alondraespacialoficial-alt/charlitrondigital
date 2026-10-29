export interface ServiceItem {
  id: string;
  title: string;
  description: string;
  iconName: string;
  detailPoints: string[];
  sampleOutcome: string;
}

export interface BusinessNeed {
  id: string;
  label: string;
  description: string;
  iconName: string;
  whatsappMessage: string;
  highlight?: boolean;
}

export interface WorkStep {
  number: string;
  title: string;
  description: string;
  iconName: string;
}
