# AGENTS.md

## Project

This repository contains Project, an AI-native software engineering training project.

The project is a personal interactive travel website documenting my European exchange experience from 2025-09-30 to 2026-04-30.

The goal is not only to complete the website, but also to practice a production-quality AI-native software engineering workflow.

Repository documentation, code comments, and commit messages should be written in English. User-facing discussion may be conducted in Traditional Chinese.
---

## Primary Engineering Goal

Help develop a production-quality software project while allowing the project owner to understand and review all important engineering decisions and generated code.

The agent should optimize for:

* Correctness
* Maintainability
* Clear domain modeling
* Testability
* Small and reviewable changes
* Explicit assumptions
* Good Git workflow
* Understanding before implementation

Do not optimize only for speed or MVP completion.

---

## Important Development Principles

### 1. Do not implement unclear requirements

If a requirement is ambiguous and the ambiguity affects:

* architecture
* data model
* domain behavior
* user experience
* implementation complexity

stop and ask for clarification.

Do not silently invent important business rules.

Minor wording or implementation details may be resolved with reasonable assumptions, but the assumption must be stated.

---

### 2. Inspect before modifying

Before modifying existing data, code, configuration, or repository structure:

1. Inspect the relevant files.
2. Explain what currently exists.
3. Identify inconsistencies or risks.
4. Propose a change.
5. Wait for approval when the change affects domain/data architecture.

---

### 3. Existing data is authoritative evidence

The Projectlready contains manually collected travel data.

Do not assume that the data was designed according to the current Domain Model.

Instead:

* inspect the existing data
* map existing fields to domain concepts
* identify missing information
* identify duplicated information
* identify inconsistent representations
* identify fields that require transformation
* identify information that cannot be derived reliably

Do not redesign the domain merely because the existing CSV structure is inconvenient.

---

### 4. Domain model before database schema

Do not immediately create database tables.

The preferred sequence is:

Existing Data
→ Data Audit
→ Domain Model validation
→ Data transformation rules
→ Data Model
→ Database Schema

---

### 5. Small changes

Prefer small, focused changes.

Avoid large rewrites unless explicitly requested.

Each implementation step should ideally be:

* understandable
* testable
* reviewable
* independently commit-able

---

### 6. Testing is required

Do not consider a feature complete merely because it runs.

For non-trivial logic:

* identify expected behavior
* define edge cases
* add tests
* run tests
* explain what was tested

Data transformation and domain logic require particular attention.

---

### 7. AI-generated code must be explainable

For significant generated code, explain:

* what it does
* why it is needed
* important design decisions
* potential alternatives
* important edge cases

The project owner should be able to understand the code before considering the implementation complete.

---

### 8. Do not over-engineer

Project is intentionally a relatively small project.

Avoid unnecessary:

* microservices
* complex infrastructure
* excessive abstractions
* premature optimization
* unnecessary distributed systems
* unnecessary database complexity

Production-quality does not mean enterprise-scale complexity.

---

## Current Development Phase

The project is currently transitioning from:

Requirements / Domain Modeling

to:

Data Audit / Data Modeling / Architecture.

The first coding task should NOT be implementation of the website.

The first task should be repository and data exploration.

---

## Workflow

For significant tasks, follow:

1. Understand context
2. Inspect repository/data
3. Identify assumptions
4. Propose approach
5. Discuss trade-offs
6. Get approval when architecture/domain changes are involved
7. Implement a small change
8. Test
9. Review
10. Update documentation if necessary

---

## Scope Control

MVP priority:

The primary feature is an interactive European travel map.

Expense visualization is intentionally simpler.

The MVP should focus on:

* Europe map
* visited country markers
* country-level navigation
* travel routes / segments
* segment interaction
* segment metadata
* basic travel information

City-level interactive navigation and Google Maps Timeline-based POI reconstruction are MVP+ unless explicitly promoted.

Do not introduce additional features without discussing scope impact.

---

## Communication Style

When proposing technical decisions:

* state the recommendation
* explain why
* identify trade-offs
* identify assumptions
* distinguish facts from suggestions

Do not simply provide code without explaining the engineering reasoning.

When multiple reasonable approaches exist, present the options briefly and recommend one.

---

## Git

Prefer small commits with clear intent.

Do not make unrelated changes in the same commit.

Before committing, verify:

* tests
* formatting/linting if applicable
* changed files
* unintended changes

Do not create commits automatically unless explicitly requested.
