"use client";

export default function AdminRolesPage() {
  return (
    <section className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-3xl md:text-4xl font-bold text-white mb-2 gradient-text">Role Management</h1>
        <p className="text-slate-400 text-sm md:text-base">
          Configure roles and permissions
        </p>
      </div>

      <div className="glass rounded-xl p-6 mb-6">
        <h3 className="text-lg font-semibold text-white mb-4">Current Role Definitions</h3>
        <div className="space-y-3 text-sm">
          <div>
            <span className="badge badge-error mr-2">super_admin</span>
            <span className="text-slate-300">Full system access, can manage all users and roles</span>
          </div>
          <div>
            <span className="badge badge-warning mr-2">admin</span>
            <span className="text-slate-300">Access to admin panel, can view and manage system data</span>
          </div>
          <div>
            <span className="badge badge-info mr-2">user</span>
            <span className="text-slate-300">Standard user access, can manage own devices and view dashboard</span>
          </div>
          <div>
            <span className="badge badge-info mr-2">driver</span>
            <span className="text-slate-300">Driver role, similar to user with driver-specific permissions</span>
          </div>
        </div>
      </div>

      <div className="glass rounded-xl p-8">
        <div className="text-center mb-6">
          <div className="inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-red-500/20 border border-red-500/30 mb-4">
            <span className="text-3xl">🔐</span>
          </div>
          <h2 className="text-2xl font-bold text-white mb-2">Permissions Management</h2>
          <p className="text-slate-400">Coming soon</p>
        </div>

        <div className="max-w-2xl mx-auto space-y-6">
          <div className="border-t border-slate-700/50 pt-6">
            <h4 className="text-lg font-semibold text-white mb-4">Planned Features</h4>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="p-4 rounded-xl bg-slate-800/50 border border-slate-700/50">
                <h5 className="font-semibold text-white mb-2">Role Permissions</h5>
                <ul className="text-sm text-slate-300 space-y-1 list-disc list-inside">
                  <li>View users, devices, commands, laps</li>
                  <li>Edit user roles</li>
                  <li>Delete records</li>
                  <li>Manage system settings</li>
                </ul>
              </div>
              <div className="p-4 rounded-xl bg-slate-800/50 border border-slate-700/50">
                <h5 className="font-semibold text-white mb-2">Granular Controls</h5>
                <ul className="text-sm text-slate-300 space-y-1 list-disc list-inside">
                  <li>Permission matrix per role</li>
                  <li>Custom permission sets</li>
                  <li>Export/import permissions</li>
                  <li>Audit logging</li>
                </ul>
              </div>
            </div>
          </div>

          <div className="border-t border-slate-700/50 pt-6">
            <div className="flex items-start gap-3 p-4 rounded-xl bg-blue-500/10 border border-blue-500/30">
              <span className="text-blue-400 text-xl">ℹ️</span>
              <div>
                <p className="text-sm font-medium text-blue-200 mb-1">Manage Roles Now</p>
                <p className="text-xs text-blue-300/80">
                  To change user roles, use the <a href="/admin/users" className="underline hover:text-blue-200">Users page</a> where you can edit roles directly in the table.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

