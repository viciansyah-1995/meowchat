# Chat Participant Fix

## Problem
With minimal RLS on `chat_participants`, the current user can only see their own participant row.
That means counting visible participant rows is not a reliable way to conclude whether the other participant already exists.

## Symptom
- duplicate key error on `(chat_id, profile_id)`
- debug showed `participantCount.before=1` then insert for the other profile failed as duplicate

## Root Cause
The row for the other participant already existed in the database, but was not visible under current SELECT policy.

## Fix
- stop using visible row count as truth
- use idempotent participant upsert with conflict-ignore semantics
- only verify visible rows for debug, not business truth
