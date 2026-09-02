# Local Agentic AI for Building Knowledge Governance and Human-Assisted Customer Support

**Proposed for:** Pace University Software Engineering Capstone<br>
**Project type:** Full-stack software engineering, local agentic AI, document understanding, and human-in-the-loop workflow<br>
**Starting point:** An existing local prototype with foundations for document intake, evidence tracking, Master/Staging review, Cases, permissions, and audit logging

## Project Summary

This project will build a system that converts apartment-building Welcome Letters into structured, reviewable, and reusable building knowledge.

A Welcome Letter is an onboarding document sent to a new resident. It may contain the building address, property-management contacts, move-in requirements, Certificate of Insurance requirements, renter's insurance instructions, electricity setup, internet-provider information, and other operational details.

Much of this information belongs to the building rather than to one tenant. Once verified, it can be reused when staff assist future customers moving into the same building.

The proposed system will:

1. Receive historical or newly forwarded Welcome Letters.
2. Parse PDF, image, and text content.
3. Identify the relevant building.
4. Extract information into a fixed building-data schema.
5. Compare new values with the approved building profile.
6. Present additions and conflicts for human review.
7. Promote approved information into the official knowledge base.
8. Link that knowledge to individual customer Cases.
9. Help staff prepare accurate answers for customers.
10. Optionally use a browser agent to look up internet-provider information or prefill an external order.

The core capstone workflow should run with an open-source or open-weight Chinese model on team-controlled hardware. Documents and prompts should not have to be sent to a proprietary cloud model for the primary workflow.

## One-Sentence Definition

> A system that turns customer-forwarded Welcome Letters into reviewable, reusable structured building knowledge and, after a staff member creates a WeChat group Case, provides human customer-service staff with immediate building information, response assistance, and limited browser-operation support.

## The Business Problem

Customer-service staff repeatedly answer questions such as:

- Does this building require a Certificate of Insurance for a move?
- Where should the COI be sent?
- Is renter's insurance required?
- Who must be listed as Additional Insured or Certificate Holder?
- Does the tenant need to open an electricity account?
- Which internet providers serve the building?
- What are the property manager's, front desk's, or maintenance team's contact details?

Today, this information may be scattered across old Welcome Letters, PDFs, email attachments, staff notes, and previous customer conversations. Searching all those documents for every question is slow and unreliable. Allowing an AI model to rewrite official information without review would also be unsafe.

The project therefore treats AI output as a proposal, not as authoritative data.

## Core Knowledge Asset

The system will maintain a structured profile for each building. A profile may include:

- Building name and address
- Property-management contact information
- Front desk and maintenance contacts
- Move-in procedures
- COI requirements, submission instructions, and triggering conditions
- Renter's insurance requirements
- Required coverage
- Additional Insured and Certificate Holder details
- Electricity setup requirements and utility provider
- Supported internet providers
- Internet setup instructions, contacts, and notes

Each field should retain its supporting evidence wherever possible, including:

- Source document
- Page number
- Original text excerpt
- Extraction confidence
- Import date
- Review status
- Version history

## Required End-to-End Workflow

> Historical Welcome Letter or new Welcome Letter forwarded by a customer<br>
> → email attachment retrieval or manual upload<br>
> → deduplication and original-document storage<br>
> → PDF, image, text parsing, and OCR<br>
> → building identification<br>
> → mapping into a fixed field schema<br>
> → field-by-field comparison with the approved profile<br>
> → Same, New, or Conflict classification<br>
> → human review in Staging<br>
> → authorized approval into Master<br>
> → building-version update and cache invalidation<br>
> → Case-to-Building binding<br>
> → human-assisted customer support

The comparison process must produce three kinds of results:

- **Same:** Preserve the new document as additional evidence without unnecessarily changing the official value.
- **New:** Create a proposed new field or value for review.
- **Conflict:** Display the current value, proposed value, and supporting evidence side by side.

For a conflict, a reviewer should be able to keep the current value, replace it, merge the values, mark it as needing further confirmation, or reject the candidate.

No AI-generated candidate may silently overwrite approved information.

## The Role of Email

Email is a document-intake channel, not a customer-service chatbot channel.

A customer may forward a Welcome Letter to a designated inbox. The proposed system should retrieve the message and attachments, detect duplicates, identify the building, parse the content, compare it with existing knowledge, and place proposed changes in the review queue.

A manual upload path should remain available as a fallback and for historical documents.

Email ingestion is a capstone requirement. It is not implemented in the current prototype.

## Cases and WeChat Groups

When a staff member creates a WeChat group for a customer, the staff member also creates a Case in the system.

A Case may include:

- WeChat group name
- Unit or apartment number
- Lease start date
- Agent
- Team
- Mentor
- Actual customer
- Linked building

The system must distinguish the formal customer from other group participants. Parents, agents, mentors, or observers in a group are not necessarily Customer records.

Once a Case is linked to a building, the principal lookup path becomes:

> Case → Building ID → approved structured fields

The system should not perform a new semantic search across every historical PDF whenever a customer asks a routine question.

## Human-Assisted Customer Support

The current WeChat environment does not provide a dependable interface for an autonomous bot to read and answer group messages.

The intended workflow is:

> Customer asks a question in a WeChat group<br>
> → staff member opens the corresponding Case<br>
> → system retrieves approved building information<br>
> → system displays structured facts, a cached summary, and optionally a draft response<br>
> → staff member verifies the answer<br>
> → staff member replies manually in WeChat

This is a **human-assisted customer support system**, not an autonomous WeChat bot.

## Search and Retrieval Design

Structured entity lookup should be the primary retrieval method.

Questions about COI, insurance, electricity, contacts, and supported internet providers should normally be answered from approved building fields.

Full-text or semantic retrieval should be a secondary capability for:

- Finding original evidence
- Retrieving partially structured notes
- Handling ambiguous or complex questions
- Providing fallback context when no structured field is available

The intended design is:

> Structured entity retrieval first; full-text or semantic retrieval as supporting evidence and fallback.

## Versioned Summary Cache

The system should avoid calling a model every time a user opens the same building profile. Generated summaries should be tied to a specific version of the approved data.

> Approved building data v12 → generate and save summary v12 → reuse summary v12<br>
> Approved field changes the building to v13 → invalidate summary v12 → generate summary v13 once

A cache key may include the Building ID, building-data version, prompt version, model version, and output language.

Simple questions should use structured fields and templates without invoking a model.

## Responsibilities and Safety Boundaries

### AI Responsibilities

The local model may assist with:

- Understanding OCR output
- Identifying a building
- Extracting and normalizing fields
- Mapping text to the building schema
- Proposing semantic comparisons
- Identifying potential conflicts
- Generating summaries
- Drafting customer replies
- Understanding browser pages
- Recommending a browser agent's next step

### Deterministic Software Responsibilities

Conventional program logic must control:

- Master and Staging state
- User roles and permissions
- Data versions
- Case-to-Building relationships
- Deduplication
- Approval state
- Cache invalidation
- Audit history
- Idempotency
- Prevention of unauthorized or repeated actions

### Human Responsibilities

A person must remain responsible for:

- Approving changes to official building knowledge
- Resolving conflicts
- Confirming browser-query results
- Reviewing customer-response drafts
- Sending the final WeChat response
- Approving any real order, contract, payment, or external submission

The governing principle is:

> AI extracts, compares, and recommends; software controls permissions and state; people approve official changes and consequential external actions.

## Local and Open-Weight Model Requirement

The capstone's primary AI workflow must use an openly licensed, open-weight Chinese model that can run on local or team-controlled hardware.

A team could evaluate a suitable Qwen, DeepSeek, or other compatible model family, subject to its license, hardware requirements, and measured performance. Possible serving technologies include llama.cpp, Ollama, or vLLM, although students may select a different appropriate stack.

Requirements include:

- At least one reference deployment that does not send document contents to a proprietary cloud model
- A replaceable model interface rather than one hard-coded model
- Documented hardware, memory, latency, and throughput
- Evaluation on the project's actual extraction tasks
- English and Chinese source-material support where practical
- Graceful failure when the model is uncertain

Fine-tuning is optional. A strong prompt-, schema-, and tool-based implementation is sufficient if it performs well.

The current prototype uses a configurable OpenAI-compatible endpoint for optional AI parsing and explanations. It also supports a separately hosted local Unlimited-OCR service. A fully local open-weight language-model workflow remains capstone work and must not be presented as already complete.

## Minimum Viable Product

The required result is one complete, demonstrable loop:

1. Import a Welcome Letter from email or manual upload.
2. Store the original document and detect duplicate imports.
3. Parse PDF, image, or text content.
4. Identify or propose the correct building.
5. Extract a defined set of building fields.
6. Retain source evidence and confidence.
7. Compare candidates with the current Master record.
8. Display new and conflicting fields in a review interface.
9. Require an authorized human to approve or reject changes.
10. Promote approved values from Staging to Master.
11. Increment the building-data version.
12. Invalidate and regenerate the appropriate cached summary.
13. Create a Case and bind it to a building.
14. Retrieve approved facts for that Case.
15. Generate an optional response draft for human review.
16. Record important operations in an audit log.

The current repository already implements portions of this structure. The student team would extend, integrate, improve, and test it rather than beginning with an entirely blank project.

## Optional Agent Extension: Internet-Provider Research

Internet-provider information should be treated in three layers.

### 1. Providers Generally Supported by a Building

Whether Verizon, Xfinity, or another provider normally serves a building is relatively stable building knowledge. It may come from Welcome Letters, historical experience, or manual confirmation.

### 2. Plans and Prices

Speeds, monthly prices, promotions, and contact details change over time. A browser agent may periodically research this information and create a timestamped update proposal. The result must still be reviewed before it becomes approved knowledge.

### 3. Real-Time Unit Availability

A provider may generally serve a building while a particular unit has different availability, installation dates, or prices.

A browser agent may open the provider's site, enter the address and unit, read availability and plans, return the result with a source and timestamp, and wait for human confirmation.

Web-interface changes, authentication, anti-automation measures, and provider terms must be considered. A reliable production deployment is not required for the core MVP.

The browser agent is an optional extension and is not implemented in the current prototype.

## Stretch Goal

The browser agent may prefill an internet-service order and stop on the final confirmation page.

The human user must review and approve the submission. The stretch goal must not include:

- Autonomous order submission
- Automated payment
- Contract acceptance
- Electronic signature
- Unattended purchase commitments

## Explicitly Out of Scope

The capstone should not attempt to deliver:

- An autonomous WeChat group bot
- Unsupervised changes to official building data
- Unattended real-world ordering
- Automatic payment or contract signing
- A complete rewrite of the existing CRM
- A general-purpose OCR research system
- A universal autonomous web agent
- A solution that depends on an unresolved AI research breakthrough

## Suggested Technical Architecture

> Email Inbox / Manual Upload<br>
> → document intake and original-file store<br>
> → PDF parser / OCR<br>
> → local open-weight model and agent tools<br>
> → candidate facts and evidence<br>
> → Staging and conflict review<br>
> → approved Master building knowledge<br>
> → Case service and customer-support workspace<br>
> → human-reviewed reply

Supporting services include role-based access control, audit logging, versioning, deduplication, idempotency, and cache invalidation.

The optional side flow is:

> Browser agent → provider research → timestamped evidence → human review

## Major Data Entities

The design will likely require:

- Building
- Building Fact
- Source Document
- Evidence Excerpt
- Candidate Fact
- Conflict
- Review Decision
- Building Version
- Case
- Customer
- Staff User and Role
- Cached Summary
- Browser Research Result
- Audit Event

Students may revise this model during discovery, but evidence, review state, versioning, and Case-to-Building relationships must remain first-class concepts.

## Expected Deliverables

The student team should provide:

- A working application integrated with the existing prototype
- Reproducible local setup instructions
- A local-model serving configuration
- Database schema and migrations
- Email and manual document-intake paths
- Extraction and comparison pipeline
- Human review interface
- Case-based customer-support interface
- Versioned summary cache
- Role and permission enforcement
- Audit logging
- Automated tests
- A small, sanitized evaluation dataset
- Extraction and workflow evaluation results
- Security and privacy notes
- Architecture and workflow documentation
- A final demonstration and recorded walkthrough

## Acceptance Criteria

The final demonstration should show that:

- A sample Welcome Letter can complete the full intake-to-support workflow.
- Every proposed fact retains a traceable source.
- Duplicate documents do not silently create duplicate records.
- Conflicts are visible and never silently overwrite approved values.
- AI output cannot enter Master without authorized human approval.
- Case-based answers use approved building data.
- Missing information is reported as unknown rather than invented.
- A building update invalidates the correct cached summary.
- Important actions appear in an audit trail.
- The core workflow operates with a local open-weight model.
- Any browser agent stops before a consequential action.
- Extraction quality, latency, and hardware usage are measured and reported.

A realistic field-level accuracy target can be agreed upon after the team establishes a baseline with the provided sample documents.

## Suggested Project Phases

### Phase 1 — Discovery and Baseline

- Review the existing prototype.
- Finalize the building schema.
- Create a sanitized document corpus.
- Establish a local-model baseline.
- Define evaluation metrics.

### Phase 2 — Intake and Extraction

- Implement email and manual intake.
- Add deduplication and original-file storage.
- Parse documents and run OCR.
- Extract building identity and candidate fields.

### Phase 3 — Governance Workflow

- Implement field comparison.
- Build the Staging review interface.
- Add conflict resolution.
- Enforce promotion to Master.
- Complete evidence and audit tracking.

### Phase 4 — Case-Based Assistance

- Bind Cases to Buildings.
- Provide structured fact retrieval.
- Generate versioned summaries.
- Add human-reviewed response drafts.

### Phase 5 — Agent Extension

- Prototype internet-provider browser research.
- Capture sources and timestamps.
- Require human confirmation.
- Attempt order prefilling only if the core system is complete.

### Phase 6 — Evaluation and Hardening

- Measure extraction accuracy and local-model performance.
- Test permissions and failure paths.
- Improve usability.
- Complete documentation and the final demonstration.

## Why This Is a Good Capstone Project

The project combines a real operational need with multiple software-engineering challenges:

- Local model deployment
- Agent and tool orchestration
- Multi-format document processing
- Structured data extraction
- Human-in-the-loop workflow design
- Conflict resolution
- Role-based access control
- Versioning and caching
- Search and retrieval
- CRM integration
- Browser automation
- Auditability and safety
- Full-stack interface development
- Testing and empirical evaluation

It does not depend on creating a new foundation model or solving general artificial intelligence. Its central challenge is engineering a reliable system around imperfect AI.

## Sponsor Collaboration

The sponsor can provide:

- Access to the existing prototype
- Domain explanations
- A proposed building-field schema
- Sanitized or synthetic Welcome Letter examples
- Feedback on workflow and interface decisions
- Periodic asynchronous review
- Meetings at mutually workable times when needed

If a student team selects the project, the exact scope, available hardware, test data, and external-provider access can be finalized during the kickoff meeting.
