# ADR 001: Separated Architecture

**Status:** ✅ Accepted  
**Date:** January 2025  
**Context:** Architecture decision for V4

---

## **Decision**

Separate the system into two distinct components:
1. **PC Service** - Lightweight Python service for rig operations
2. **Web Application** - Next.js application hosted on Vercel

Both communicate directly with Supabase (no intermediate API layer).

---

## **Context**

Previous versions (`ircommander/`) had:
- Flask server serving both API and frontend
- Mixed concerns (web serving + PC operations)
- Harder to scale and maintain

---

## **Options Considered**

### **Option 1: Monolithic Flask Server** (Old approach)
- ❌ Serves webpages + API + PC operations
- ❌ Harder to scale
- ❌ Mixed concerns

### **Option 2: Separated Architecture** ✅ (Chosen)
- ✅ Clear separation of concerns
- ✅ PC service is lightweight
- ✅ Web app scales independently
- ✅ Direct Supabase connections (no API overhead)

### **Option 3: Microservices**
- ❌ Over-engineered for current needs
- ❌ More complexity
- ❌ Higher operational overhead

---

## **Consequences**

### **Positive:**
- ✅ Simpler PC service (no web server needed)
- ✅ Web app scales independently on Vercel
- ✅ Clear separation of responsibilities
- ✅ Easier to maintain and update
- ✅ Lower cost (Vercel free tier)

### **Negative:**
- ⚠️ Two codebases to maintain
- ⚠️ Need to coordinate deployments
- ⚠️ Requires Supabase for communication

### **Mitigations:**
- Clear documentation in `docs/architecture/`
- Shared database (Supabase) ensures consistency
- Independent deployments are actually a benefit

---

## **References**

- `docs/architecture/ARCHITECTURE.md` - Full architecture
- `docs/architecture/SEPARATED_ARCHITECTURE.md` - Detailed separation explanation

---

**Decision By:** Architecture Team  
**Approved:** January 2025



