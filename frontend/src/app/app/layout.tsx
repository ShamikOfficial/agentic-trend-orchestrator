import { DisabledFeatureRedirect } from "@/components/disabled-feature-redirect";

export default function AppSectionLayout({ children }: { children: React.ReactNode }) {
  return <DisabledFeatureRedirect>{children}</DisabledFeatureRedirect>;
}
