# 10DLC resubmission checklist

Start with the rejection code and your provider's explanation. Then compare the campaign description, sample messages, consent flow, and supporting pages. Fixing the named field can still leave inconsistencies elsewhere.

This checklist is preparation guidance, not legal advice or an approval guarantee. Describe the business and consent process you actually have; do not invent evidence to satisfy a checklist or improve a scanner result.

## Check the packet

- [ ] **Sender and purpose:** the business identity, selected use case, description, and samples describe the same sender and kind of messages. Distinguish appointment/account notifications from promotional offers.
- [ ] **Audience and frequency:** explain who receives messages, why, and the expected frequency. Use facts from the actual messaging program.
- [ ] **Every opt-in method:** describe each way people consent, including the instructions or disclosures they encounter. Do not replace a paper, verbal, or keyword process with an invented web-form story.
- [ ] **Evidence for web opt-in, if used:** identify the specific page and show the actual consent experience. For an optional checkbox, show its real wording and default state. If supporting content is not public, follow the provider's guidance for publicly accessible screenshots; do not expose subscriber records or other private data.
- [ ] **Representative samples:** make the sender recognizable and keep samples consistent with the stated purpose. Check current provider requirements for STOP/HELP, rate disclosures, and links for your use case. Adding a keyword does not establish consent or guarantee approval.
- [ ] **Supporting pages:** verify the relevant business, privacy-policy, and terms pages are reachable and accurately describe the same sender and SMS program. Follow current provider guidance on opt-in data handling and disclosures.
- [ ] **Final comparison:** read the description, samples, and opt-in explanation together. Correct contradictions without changing the underlying business facts. Resubmit through your provider using its current instructions.

Twilio's [30909 guidance](https://www.twilio.com/docs/api/errors/30909) explains opt-in evidence and multiple opt-in paths. Its [30907 guidance](https://www.twilio.com/docs/api/errors/30907) covers website/sender consistency and supporting screenshots. These are examples of specific rejection guidance, not a complete list of requirements.

## Worked example: two synthetic drafts

**Everything below is invented for illustration.** Ridgeway Property Management is a fictional business. No campaign in this example was submitted, scanned, rejected, or approved.

For this example only, assume current tenants can choose maintenance-update texts using an optional, initially unchecked checkbox on a public signup page. That is a hypothetical business fact, not a consent process to copy if your users do something different.

### Incomplete draft

Description:
> We send text messages to customers about appointments.

Samples:
> Your appointment is tomorrow.
>
> Reminder: service visit scheduled.

The reader cannot identify the sender or audience, see how consent was obtained, or tell which appointments the messages concern.

### More specific draft

Description:
> Ridgeway Property Management sends maintenance appointment confirmations and reminders to current tenants who choose SMS updates at https://ridgeway.example/sms-preferences. The optional checkbox is unchecked by default and describes maintenance-update texts, expected frequency, and STOP/HELP instructions. Tenants receive approximately 2–4 messages per month while a maintenance request is active. Privacy and terms links appear with the disclosure.

Samples:
> Ridgeway PM: Your maintenance visit is confirmed for March 4 at 10 AM. Reply STOP to opt out or HELP for help.
>
> Ridgeway PM: Your maintenance visit tomorrow has moved from 10 AM to 2 PM. Reply STOP to opt out or HELP for help.

The revised draft identifies the sender, limits the purpose to maintenance updates, and describes a concrete opt-in path. A real submission would still need the actual disclosure, supporting evidence, and any additional information required by the provider. This is not a compliance determination or an approved template.

`ridgeway.example` uses the reserved `.example` domain. It is not a working signup page; do not scan it or treat the example as a real campaign.

## Optional A2PCheck review

Bring your campaign description, at least two representative sample messages, and an accurate opt-in explanation. Use campaign-level examples, not subscriber data or credentials.

| Capability | Anonymous Basic | Signed-in Basic | Full |
| --- | --- | --- | --- |
| Review pasted description, samples, and opt-in details | Included | Included | Included |
| Fetch and analyze privacy-policy and terms page contents | Not included | Not included | Included |
| Dedicated cross-field consistency check | Not included | Not included | Included |
| Credit cost | Free within usage limits | 1 credit | 2 credits |

Neither Basic nor Full fetches the business website. A2PCheck does not register campaigns, query provider approval status, send test SMS, or guarantee approval. Registration and approval decisions remain with providers and their review processes.

[Run an anonymous Basic check](https://www.a2pcheck.com/10dlc-check?utm_source=github&utm_medium=referral&utm_campaign=checklist_doc). Using A2PCheck is optional; you can do the preparation above without it.

## Official references

- [Twilio 30909: opt-in/message-flow evidence](https://www.twilio.com/docs/api/errors/30909)
- [Twilio 30907: website and campaign consistency](https://www.twilio.com/docs/api/errors/30907)
- [Twilio Messaging Policy](https://www.twilio.com/en-us/legal/messaging-policy)

Checked November 12, 2026. Requirements can change; use the current guidance for your provider, campaign, and rejection code.
