# Development Guide

**Workflow and best practices for V4 development**

---

## 🏗️ **Project Structure**

```
_V4/
├── docs/              # Documentation
├── pc-service/        # Python PC service
├── web-app/           # Next.js web application
└── reference/         # Reference materials
```

---

## 🔄 **Development Workflow**

### **1. Start Development:**
```bash
# Terminal 1: PC Service
cd pc-service
python start.py --api

# Terminal 2: Web App
cd web-app
npm run dev
```

### **2. Make Changes:**
- PC Service: Edit files in `pc-service/src/`
- Web App: Edit files in `web-app/src/`

### **3. Test:**
- PC Service: Check logs and GUI
- Web App: Check browser console and network tab

### **4. Commit:**
```bash
git add .
git commit -m "Description of changes"
```

---

## 📝 **Code Standards**

### **Python (PC Service):**
- Follow PEP 8 style guide
- Use type hints where possible
- Document functions with docstrings
- Keep functions focused and small

### **TypeScript/React (Web App):**
- Use TypeScript for type safety
- Follow React best practices
- Use functional components
- Keep components small and focused

---

## 🧪 **Testing**

### **PC Service:**
```bash
cd pc-service
pytest tests/
```

### **Web App:**
```bash
cd web-app
npm test
```

---

## 📚 **Documentation**

### **When to Document:**
- New features → Update `docs/architecture/`
- API changes → Update `docs/reference/`
- Setup changes → Update `docs/guides/`
- Decisions → Create ADR in `docs/decisions/`

### **Documentation Standards:**
- Clear, concise language
- Code examples where helpful
- Keep up to date
- Link related documents

---

## 🔍 **Code Review**

Before committing:
- [ ] Code follows standards
- [ ] Tests pass
- [ ] Documentation updated
- [ ] No console errors
- [ ] No linter errors

---

## 🚀 **Deployment**

See `DEPLOYMENT.md` for production deployment instructions.

---

**Last Updated:** January 2025



