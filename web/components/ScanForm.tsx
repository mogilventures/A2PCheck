"use client";

import { useState } from "react";
import { ScanRequest } from "@/lib/types";
import { Minus, Plus, Scan, Zap } from "lucide-react";

const USE_CASES: { value: string; label: string }[] = [
  { value: "MARKETING", label: "Marketing" },
  { value: "ACCOUNT_NOTIFICATION", label: "Account Notifications" },
  { value: "CUSTOMER_CARE", label: "Customer Care" },
  { value: "DELIVERY_NOTIFICATION", label: "Delivery Notifications" },
  { value: "FRAUD_ALERT", label: "Fraud Alerts" },
  { value: "HIGHER_EDUCATION", label: "Higher Education" },
  { value: "LOW_VOLUME", label: "Low Volume" },
  { value: "MIXED", label: "Mixed" },
  { value: "POLLING_VOTING", label: "Polling & Voting" },
  { value: "PUBLIC_SERVICE_ANNOUNCEMENT", label: "Public Service Announcement" },
  { value: "SECURITY_ALERT", label: "Security Alerts" },
  { value: "TWO_FACTOR_AUTH", label: "Two-Factor Authentication" },
  { value: "CHARITY", label: "Charity" },
  { value: "EMERGENCY", label: "Emergency" },
  { value: "POLITICAL", label: "Political" },
  { value: "SWEEPSTAKE", label: "Sweepstakes" },
];

const inputClass =
  "w-full rounded-lg border border-stone-300 dark:border-stone-600 bg-white dark:bg-stone-800 px-3 py-2 text-sm text-stone-800 dark:text-stone-200 placeholder:text-stone-400 dark:placeholder:text-stone-500 focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/40 focus:border-[var(--accent)] transition-colors";
const labelClass = "block text-sm font-medium text-stone-700 dark:text-stone-300 mb-1";
const errorClass = "text-xs text-red-600 mt-1";

function FormSection({
  number,
  title,
  description,
  children,
  last = false,
}: {
  number: string;
  title: string;
  description?: string;
  children: React.ReactNode;
  last?: boolean;
}) {
  return (
    <section className={last ? "" : "pb-10 border-b border-stone-200 dark:border-stone-700"}>
      <div className="mb-4">
        <span className="text-xs font-semibold tracking-widest text-[var(--accent)] mb-1 block">
          {number}
        </span>
        <h2 className="text-xl font-semibold tracking-tight text-stone-800 dark:text-stone-200">
          {title}
        </h2>
        {description && (
          <p className="text-sm text-stone-500 mt-1">{description}</p>
        )}
      </div>
      {children}
    </section>
  );
}

interface Props {
  onSubmit: (data: ScanRequest, quick: boolean) => void;
  loading: boolean;
}

export default function ScanForm({ onSubmit, loading }: Props) {
  const [useCaseType, setUseCaseType] = useState("MARKETING");
  const [campaignDescription, setCampaignDescription] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [sampleMessages, setSampleMessages] = useState(["", ""]);
  const [messageFlow, setMessageFlow] = useState("");
  const [optInKeywords, setOptInKeywords] = useState("START, YES");
  const [optOutKeywords, setOptOutKeywords] = useState("STOP, UNSUBSCRIBE, CANCEL");
  const [helpKeywords, setHelpKeywords] = useState("HELP, INFO");
  const [optInMessage, setOptInMessage] = useState("");
  const [optOutMessage, setOptOutMessage] = useState("");
  const [helpMessage, setHelpMessage] = useState("");
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [privacyPolicyUrl, setPrivacyPolicyUrl] = useState("");
  const [termsOfServiceUrl, setTermsOfServiceUrl] = useState("");
  const [embeddedLinks, setEmbeddedLinks] = useState(false);
  const [embeddedPhoneNumbers, setEmbeddedPhoneNumbers] = useState(false);
  const [ageGatedContent, setAgeGatedContent] = useState(false);
  const [directLending, setDirectLending] = useState(false);
  const [numberPool, setNumberPool] = useState(false);

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [touched, setTouched] = useState(false);

  function parseKeywords(s: string): string[] {
    return s
      .split(",")
      .map((k) => k.trim())
      .filter(Boolean);
  }

  function validate(): Record<string, string> {
    const errs: Record<string, string> = {};
    if (!campaignDescription.trim()) {
      errs.campaignDescription = "Campaign description is required.";
    }
    const filledMessages = sampleMessages.filter((m) => m.trim());
    if (filledMessages.length < 2) {
      errs.sampleMessages = "At least 2 sample messages are required.";
    }
    if (!messageFlow.trim()) {
      errs.messageFlow = "Message flow description is required.";
    }
    return errs;
  }

  function buildRequest(): ScanRequest {
    return {
      useCaseType,
      campaignDescription,
      sampleMessages: sampleMessages.filter(Boolean),
      messageFlow,
      businessName: businessName || undefined,
      privacyPolicyUrl: privacyPolicyUrl || undefined,
      websiteUrl: websiteUrl || undefined,
      termsOfServiceUrl: termsOfServiceUrl || undefined,
      optInKeywords: parseKeywords(optInKeywords),
      optOutKeywords: parseKeywords(optOutKeywords),
      helpKeywords: parseKeywords(helpKeywords),
      optInMessage: optInMessage || undefined,
      optOutMessage: optOutMessage || undefined,
      helpMessage: helpMessage || undefined,
      embeddedLinks,
      embeddedPhoneNumbers,
      ageGatedContent,
      directLending,
      numberPool,
    };
  }

  function handleSubmit(e: React.FormEvent, quick: boolean) {
    e.preventDefault();
    setTouched(true);
    const errs = validate();
    setErrors(errs);
    if (Object.keys(errs).length > 0) return;
    onSubmit(buildRequest(), quick);
  }

  // Re-validate on change if user has already attempted to submit
  function revalidate() {
    if (touched) setErrors(validate());
  }

  return (
    <form onSubmit={(e) => handleSubmit(e, false)} className="space-y-10" noValidate>
      {/* Campaign Info */}
      <FormSection number="01" title="Campaign Info" description="Basic details about your messaging campaign.">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="useCaseType" className={labelClass}>Use Case Type *</label>
            <select
              id="useCaseType"
              className={inputClass}
              value={useCaseType}
              onChange={(e) => setUseCaseType(e.target.value)}
            >
              {USE_CASES.map((uc) => (
                <option key={uc.value} value={uc.value}>
                  {uc.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="businessName" className={labelClass}>Business Name</label>
            <input
              id="businessName"
              className={inputClass}
              placeholder="Your Company Inc."
              value={businessName}
              onChange={(e) => setBusinessName(e.target.value)}
            />
          </div>
          <div className="sm:col-span-2">
            <label htmlFor="campaignDescription" className={labelClass}>Campaign Description *</label>
            <textarea
              id="campaignDescription"
              className={`${inputClass} min-h-[100px] ${errors.campaignDescription ? "border-red-400 focus:ring-red-400/40 focus:border-red-400" : ""}`}
              placeholder="Describe the purpose, audience, and content of your campaign messages..."
              value={campaignDescription}
              onChange={(e) => {
                setCampaignDescription(e.target.value);
                revalidate();
              }}
            />
            {errors.campaignDescription && <p className={errorClass}>{errors.campaignDescription}</p>}
          </div>
        </div>
      </FormSection>

      {/* Sample Messages */}
      <FormSection number="02" title="Sample Messages" description="Provide at least 2 example messages you'll send.">
        <div className="space-y-3">
          {sampleMessages.map((msg, i) => (
            <div key={i} className="flex gap-2">
              <textarea
                id={`sampleMessage-${i}`}
                aria-label={`Sample message ${i + 1}`}
                className={`${inputClass} min-h-[60px] flex-1 ${errors.sampleMessages && i < 2 ? "border-red-400 focus:ring-red-400/40 focus:border-red-400" : ""}`}
                placeholder={`Sample message ${i + 1}${i < 2 ? " (required)" : ""}...`}
                value={msg}
                onChange={(e) => {
                  const next = [...sampleMessages];
                  next[i] = e.target.value;
                  setSampleMessages(next);
                  revalidate();
                }}
              />
              {i >= 2 && (
                <button
                  type="button"
                  aria-label={`Remove sample message ${i + 1}`}
                  onClick={() =>
                    setSampleMessages(sampleMessages.filter((_, j) => j !== i))
                  }
                  className="self-start p-2 text-stone-400 hover:text-red-500"
                >
                  <Minus size={16} />
                </button>
              )}
            </div>
          ))}
          {errors.sampleMessages && <p className={errorClass}>{errors.sampleMessages}</p>}
          {sampleMessages.length < 5 && (
            <button
              type="button"
              aria-label="Add another sample message"
              onClick={() => setSampleMessages([...sampleMessages, ""])}
              className="text-sm text-stone-500 hover:text-stone-700 flex items-center gap-1"
            >
              <Plus size={14} /> Add sample message
            </button>
          )}
        </div>
      </FormSection>

      {/* Consent & Flow */}
      <FormSection number="03" title="Consent & Message Flow" description="How users opt in, out, and get help.">
        <div className="space-y-4">
          <div>
            <label htmlFor="messageFlow" className={labelClass}>Message Flow / Opt-In Description *</label>
            <textarea
              id="messageFlow"
              className={`${inputClass} min-h-[80px] ${errors.messageFlow ? "border-red-400 focus:ring-red-400/40 focus:border-red-400" : ""}`}
              placeholder="Describe how users opt-in to receive messages (e.g., website form, checkout checkbox)..."
              value={messageFlow}
              onChange={(e) => {
                setMessageFlow(e.target.value);
                revalidate();
              }}
            />
            {errors.messageFlow && <p className={errorClass}>{errors.messageFlow}</p>}
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <label htmlFor="optInKeywords" className={labelClass}>Opt-In Keywords</label>
              <input
                id="optInKeywords"
                className={inputClass}
                placeholder="START, YES"
                value={optInKeywords}
                onChange={(e) => setOptInKeywords(e.target.value)}
              />
            </div>
            <div>
              <label htmlFor="optOutKeywords" className={labelClass}>Opt-Out Keywords</label>
              <input
                id="optOutKeywords"
                className={inputClass}
                placeholder="STOP, UNSUBSCRIBE"
                value={optOutKeywords}
                onChange={(e) => setOptOutKeywords(e.target.value)}
              />
            </div>
            <div>
              <label htmlFor="helpKeywords" className={labelClass}>Help Keywords</label>
              <input
                id="helpKeywords"
                className={inputClass}
                placeholder="HELP, INFO"
                value={helpKeywords}
                onChange={(e) => setHelpKeywords(e.target.value)}
              />
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <label htmlFor="optInMessage" className={labelClass}>Opt-In Confirmation Message</label>
              <textarea
                id="optInMessage"
                className={`${inputClass} min-h-[60px]`}
                placeholder="Message sent after opt-in..."
                value={optInMessage}
                onChange={(e) => setOptInMessage(e.target.value)}
              />
            </div>
            <div>
              <label htmlFor="optOutMessage" className={labelClass}>Opt-Out Confirmation Message</label>
              <textarea
                id="optOutMessage"
                className={`${inputClass} min-h-[60px]`}
                placeholder="Message sent after opt-out..."
                value={optOutMessage}
                onChange={(e) => setOptOutMessage(e.target.value)}
              />
            </div>
            <div>
              <label htmlFor="helpMessage" className={labelClass}>Help Response Message</label>
              <textarea
                id="helpMessage"
                className={`${inputClass} min-h-[60px]`}
                placeholder="Message sent when HELP is received..."
                value={helpMessage}
                onChange={(e) => setHelpMessage(e.target.value)}
              />
            </div>
          </div>
        </div>
      </FormSection>

      {/* URLs */}
      <FormSection number="04" title="URLs" description="Links to your website, privacy policy, and terms.">
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <label htmlFor="websiteUrl" className={labelClass}>Website URL</label>
            <input
              id="websiteUrl"
              className={inputClass}
              type="url"
              placeholder="https://example.com"
              value={websiteUrl}
              onChange={(e) => setWebsiteUrl(e.target.value)}
            />
          </div>
          <div>
            <label htmlFor="privacyPolicyUrl" className={labelClass}>Privacy Policy URL</label>
            <input
              id="privacyPolicyUrl"
              className={inputClass}
              type="url"
              placeholder="https://example.com/privacy"
              value={privacyPolicyUrl}
              onChange={(e) => setPrivacyPolicyUrl(e.target.value)}
            />
          </div>
          <div>
            <label htmlFor="termsOfServiceUrl" className={labelClass}>Terms of Service URL</label>
            <input
              id="termsOfServiceUrl"
              className={inputClass}
              type="url"
              placeholder="https://example.com/terms"
              value={termsOfServiceUrl}
              onChange={(e) => setTermsOfServiceUrl(e.target.value)}
            />
          </div>
        </div>
      </FormSection>

      {/* Content Flags */}
      <FormSection number="05" title="Content Flags" description="Declare any special content attributes." last>
        <div className="flex flex-wrap gap-x-6 gap-y-3">
          {[
            { id: "embeddedLinks", label: "Embedded links", value: embeddedLinks, set: setEmbeddedLinks },
            { id: "embeddedPhoneNumbers", label: "Embedded phone numbers", value: embeddedPhoneNumbers, set: setEmbeddedPhoneNumbers },
            { id: "ageGatedContent", label: "Age-gated content", value: ageGatedContent, set: setAgeGatedContent },
            { id: "directLending", label: "Direct lending/loans", value: directLending, set: setDirectLending },
            { id: "numberPool", label: "Number pool", value: numberPool, set: setNumberPool },
          ].map(({ id, label, value, set }) => (
            <label
              key={id}
              htmlFor={id}
              className="flex items-center gap-2 text-sm text-stone-700 dark:text-stone-300 cursor-pointer"
            >
              <input
                id={id}
                type="checkbox"
                checked={value}
                onChange={(e) => set(e.target.checked)}
                className="rounded border-stone-300 text-[var(--accent)] focus:ring-[var(--accent)]"
              />
              {label}
            </label>
          ))}
        </div>
      </FormSection>

      {/* Submit */}
      <div className="flex flex-col sm:flex-row gap-3 pt-2">
        <button
          type="submit"
          disabled={loading}
          className="flex-1 flex items-center justify-center gap-2 rounded-lg bg-[var(--accent)] px-6 py-3 text-sm font-semibold text-white hover:bg-[var(--accent-hover)] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          <Scan size={16} />
          Full Scan (~15-20s)
        </button>
        <button
          type="button"
          onClick={(e) => handleSubmit(e, true)}
          disabled={loading}
          className="flex-1 flex items-center justify-center gap-2 rounded-lg border-2 border-[var(--accent)]/30 px-6 py-3 text-sm font-semibold text-[var(--accent)] hover:bg-[var(--accent-subtle)] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          <Zap size={16} />
          Quick Scan (~5-8s)
        </button>
      </div>
    </form>
  );
}
