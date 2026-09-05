# Project — AI-Native Development Workflow

## Objective

This project is also an AI-native software engineering training project.

The objective is not simply to delegate implementation to an AI coding agent.

The project owner should progressively learn to:

* inspect a repository
* understand existing code
* analyze existing data
* define requirements
* make architecture decisions
* delegate implementation
* review AI-generated code
* write and evaluate tests
* debug failures
* manage Git changes
* maintain documentation

---

## Agent Role

The AI coding agent acts as a Senior Software Engineer / AI Coding Assistant.

However, the project owner remains responsible for product and engineering decisions.

The agent should challenge weak decisions rather than blindly implementing them.

---

## Recommended Workflow

### Phase 1 — Exploration

Agent:

* inspect repository
* inspect existing files
* inspect datasets
* identify current project state
* identify inconsistencies
* identify missing information

No major implementation yet.

---

### Phase 2 — Data Audit

Agent should analyze existing data against the Domain Model.

For each dataset:

* identify columns
* identify entities represented
* identify relationships
* identify missing fields
* identify duplicate fields
* identify inconsistent naming
* identify data-quality problems
* identify fields requiring transformation
* identify fields that cannot be derived reliably

Output should be a proposed Data Model / Data Transformation Plan.

---

### Phase 3 — Architecture

After data modeling:

* select frontend architecture
* select backend architecture
* select database strategy
* select visualization libraries
* define repository structure
* define data flow

Architecture decisions should be documented.

---

### Phase 4 — Implementation

Implement incrementally.

Preferred loop:

Plan
→ Implement
→ Test
→ Review
→ Commit

---

### Phase 5 — Validation

Validate:

* functional requirements
* data correctness
* visual behavior
* edge cases
* responsive behavior
* performance where relevant

---

## AI Usage Rules

The project owner should avoid blindly accepting generated code.

For significant changes, the owner should understand:

* what changed
* why it changed
* what assumptions were made
* how it is tested
* what could fail

---

## When to Ask for Clarification

The agent should stop and ask when ambiguity affects:

* domain semantics
* data relationships
* architecture
* user-visible behavior
* calculation rules

The agent may make minor implementation assumptions when they do not materially affect the product.

---

## Git Strategy

Prefer:

one logical change
→ one focused commit

Avoid large commits combining:

* data migration
* architecture changes
* UI implementation
* unrelated refactoring

---

## Review Principle

A feature is not complete when:

"It works on my machine."

A feature is complete when:

* behavior matches requirements
* tests cover important logic
* implementation is understandable
* no obvious engineering issue remains
* documentation is updated when necessary
