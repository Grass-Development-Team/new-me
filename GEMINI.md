# Sunflower (New ME) - Project Overview

Sunflower is a TypeScript-based AI agent framework (v3.5.0.0) designed for interactive communication, specifically optimized for IM (Instant Messaging) platforms. It focuses on simulating human-like behavior and maintaining user-specific state like "affection scores."

## Operational Protocols (Crucial)

- **Incremental Execution**: All implementation plans must proceed in small, verifiable steps.
- **Reporting & Tracking**: After each small step, the AI must report completion and update the task list in `GEMINI.md` by marking the item as completed (`[x]`).
- **Session Validation**: At the beginning of every session (or after a reset), the AI must output the following phrase to verify adherence to these protocols:
  > **"Session Start: Adhering to Sunflower v3.5 Refactoring Protocols."**

## Core Architecture

- **Sunflower Class (`src/sunflower/index.ts`)**: The central coordinator that manages instances, storage, and AI adapters.
- **Instance (`src/sunflower/instance.ts`)**: Represents a specific chat session (e.g., a group or private chat). It manages message history, locks for sequential processing, and interaction with scenes.
- **Scenes (`src/sunflower/scene/`)**: Modular components that define the "context" or "environment" for the AI.
- **Storage (`src/sunflower/storage/`)**: Currently uses `LevelDB` for persistent storage.
- **Memory (`src/sunflower/memory/`)**: (In progress) The new caching and high-level memory management layer.

## Current Goals / Roadmap (Reconstruction Plan)

The project is undergoing a major architectural refactoring to decouple **Persistence (Storage)** from **Memory/Caching (Memory)**.

### Phase 1: Foundation
- [ ] **1.1 Implementation of Universal LRU Tool**: Create `LRUCache` in `src/utils/lru.ts` using Map + Doubly Linked List.
- [ ] **1.2 Standardize IStorage Interface**: Define clear `get/set/del` methods in `src/sunflower/storage/types.ts`.
- [ ] **1.3 Define Memory Entity Types**: Standardize structures for cached data in `src/sunflower/memory/types.ts`.

### Phase 2: Memory Framework (`src/sunflower/memory/`)
- [ ] **2.1 Core Memory Class**: Create the central hub for managing multiple LRU instances.
- [ ] **2.2 Cache-Aside Logic**: Implement standard loading/synchronization patterns.
- [ ] **2.3 Modular Managers**: Specialized logic for User and Conversation memory.

### Phase 3: Storage Refinement
- [ ] **3.1 Strip Legacy Caching**: Remove `user_cache` and `instance_cache` from `Storage`.
- [ ] **3.2 SQL Alignment**: Refactor method signatures for future relational DB compatibility.
- [ ] **3.3 SQL Driver Selection**: Finalize and implement the new SQL-based storage driver.

### Phase 4: Global Integration
- [ ] **4.1 Sunflower Registry Refactor**: Update initialization order (`Storage` -> `Memory`).
- [ ] **4.2 Business Logic Migration**: Update `Instance` and `AddScore` tool to use `Memory` API.

### Phase 5: Validation
- [ ] **5.1 Unit Tests for LRU & Sync**: Verify eviction and loading logic.
- [ ] **5.2 Performance Profiling**: Adjust memory limits and interaction latency.

### Phase 6: Future Extensions (TBD)
- [ ] **6.1 Dynamic Memory Allocation**: Frequency-based memory management.
- [ ] **6.2 Cross-Group Shared Memory**: Platform-wide user state.
- [ ] **6.3 RAG Integration**: Vector-based long-term retrieval.
- [ ] **6.4 Advanced Media Caching**: Better handling of non-text history.
