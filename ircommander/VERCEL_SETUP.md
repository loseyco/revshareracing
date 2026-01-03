# Vercel Setup for iRCommander

**Project created successfully!**

---

## ✅ **Project Created**

- **Project Name:** `ircommander`
- **Vercel URL:** `https://ircommander.vercel.app`
- **Preview URL:** `https://ircommander-*.vercel.app`

---

## 🔧 **Next Steps**

### 1. Set Custom Domain

Add the custom domain `ircommander.gridpass.app`:

**Via Dashboard:**
1. Go to https://vercel.com/dashboard
2. Select `ircommander` project
3. Go to **Settings** → **Domains**
4. Add Domain: `ircommander.gridpass.app`
5. Follow DNS instructions if needed

**Via CLI:**
```bash
cd ircommander
vercel domains add ircommander.gridpass.app
```

### 2. Set Environment Variables

You need to set these in Vercel:

**Required:**
- `NEXT_PUBLIC_SUPABASE_URL` - Your Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Supabase anon key
- `SUPABASE_SERVICE_ROLE_KEY` - Supabase service role key

**Via Dashboard:**
1. Go to https://vercel.com/dashboard
2. Select `ircommander` project
3. Go to **Settings** → **Environment Variables**
4. Add each variable for **Production**, **Preview**, and **Development**

**Via CLI:**
```bash
cd ircommander

# Set for production
echo "YOUR_SUPABASE_URL" | vercel env add NEXT_PUBLIC_SUPABASE_URL production
echo "YOUR_ANON_KEY" | vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY production
echo "YOUR_SERVICE_ROLE_KEY" | vercel env add SUPABASE_SERVICE_ROLE_KEY production

# Set for preview
echo "YOUR_SUPABASE_URL" | vercel env add NEXT_PUBLIC_SUPABASE_URL preview
echo "YOUR_ANON_KEY" | vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY preview
echo "YOUR_SERVICE_ROLE_KEY" | vercel env add SUPABASE_SERVICE_ROLE_KEY preview

# Set for development
echo "YOUR_SUPABASE_URL" | vercel env add NEXT_PUBLIC_SUPABASE_URL development
echo "YOUR_ANON_KEY" | vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY development
echo "YOUR_SERVICE_ROLE_KEY" | vercel env add SUPABASE_SERVICE_ROLE_KEY development
```

### 3. Deploy to Production

Once environment variables are set:

```bash
cd ircommander
vercel --prod
```

This will deploy to:
- Production URL: `https://ircommander.vercel.app`
- Custom domain: `https://ircommander.gridpass.app` (after DNS is configured)

---

## 🧪 **Test the Deployment**

After deploying, test the API:

```bash
# Health check
curl https://ircommander.gridpass.app/api/v1/health

# Or if custom domain not ready yet:
curl https://ircommander.vercel.app/api/v1/health
```

---

## 📝 **Update Client Configuration**

Once deployed, update your client `.env`:

```env
IRCOMMANDER_API_URL=https://ircommander.gridpass.app
```

Or use the Vercel URL temporarily:
```env
IRCOMMANDER_API_URL=https://ircommander.vercel.app
```

---

## 🔍 **Verify Setup**

Check project status:
```bash
cd ircommander
vercel ls
vercel inspect
```

View environment variables:
```bash
vercel env ls
```

---

**Last Updated:** January 2025
