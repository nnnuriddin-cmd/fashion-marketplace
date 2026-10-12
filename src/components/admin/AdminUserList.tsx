'use client';

import React, { useState, useMemo } from 'react';
import { Users, Search, ShieldCheck, Store, User, CheckCircle2, XCircle } from 'lucide-react';
import { AdminUserListItem } from '@/lib/db';

interface AdminUserListProps {
  initialUsers: AdminUserListItem[];
}

export default function AdminUserList({ initialUsers }: AdminUserListProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState<'ALL' | 'CUSTOMER' | 'SELLER' | 'ADMIN'>('ALL');

  const filteredUsers = useMemo(() => {
    return initialUsers.filter((user) => {
      const matchesRole = roleFilter === 'ALL' || user.role === roleFilter;
      const term = searchTerm.toLowerCase().trim();
      const matchesSearch =
        !term ||
        user.full_name?.toLowerCase().includes(term) ||
        user.email?.toLowerCase().includes(term) ||
        user.phone?.toLowerCase().includes(term);

      return matchesRole && matchesSearch;
    });
  }, [initialUsers, roleFilter, searchTerm]);

  return (
    <div className="bg-white rounded-3xl border border-neutral-200 p-6 space-y-4 shadow-sm">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-neutral-100 pb-4">
        <div>
          <h3 className="text-lg font-serif font-bold text-neutral-900 flex items-center gap-2">
            <Users className="w-5 h-5 text-indigo-700" />
            <span>Registered Users Directory</span>
          </h3>
          <p className="text-xs text-neutral-500">
            All marketplace customers, boutique sellers, and administrators
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-neutral-100 text-neutral-700">
            {initialUsers.length} Total Users
          </span>
        </div>
      </div>

      {/* Filters & Search */}
      <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
        <div className="relative flex-1 max-w-sm">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
          <input
            type="text"
            placeholder="Search by name, email, or phone..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 text-xs rounded-xl border border-neutral-200 focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-neutral-900"
          />
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto text-xs">
          {(['ALL', 'CUSTOMER', 'SELLER', 'ADMIN'] as const).map((r) => (
            <button
              key={r}
              onClick={() => setRoleFilter(r)}
              className={`px-3 py-1.5 rounded-xl font-medium transition-colors ${
                roleFilter === r
                  ? 'bg-neutral-900 text-white'
                  : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
              }`}
            >
              {r === 'ALL' ? 'All Roles' : r}
            </button>
          ))}
        </div>
      </div>

      {/* Users Table / List */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="border-b border-neutral-100 text-neutral-400 font-semibold uppercase tracking-wider text-[10px]">
              <th className="pb-2">User / Name</th>
              <th className="pb-2">Contact Details</th>
              <th className="pb-2">Role</th>
              <th className="pb-2">Telegram Bot</th>
              <th className="pb-2 text-right">Registered</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {filteredUsers.length === 0 ? (
              <tr>
                <td colSpan={5} className="py-8 text-center text-neutral-400 text-xs">
                  No users found matching your filters.
                </td>
              </tr>
            ) : (
              filteredUsers.map((u) => {
                const createdDate = new Date(u.created_at).toLocaleDateString('ru-RU', {
                  day: 'numeric',
                  month: 'short',
                  year: 'numeric',
                });

                return (
                  <tr key={u.id} className="hover:bg-neutral-50/50 transition-colors">
                    <td className="py-3 pr-4">
                      <div className="font-bold text-neutral-900">{u.full_name || 'No Name'}</div>
                      <div className="text-[10px] text-neutral-400 font-mono truncate max-w-[140px]" title={u.id}>
                        {u.id}
                      </div>
                    </td>
                    <td className="py-3 pr-4">
                      <div className="text-neutral-800 font-medium">{u.email}</div>
                      <div className="text-neutral-500">{u.phone || 'No phone'}</div>
                    </td>
                    <td className="py-3 pr-4">
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                          u.role === 'ADMIN'
                            ? 'bg-purple-100 text-purple-800'
                            : u.role === 'SELLER'
                            ? 'bg-sky-100 text-sky-800'
                            : 'bg-neutral-100 text-neutral-700'
                        }`}
                      >
                        {u.role === 'ADMIN' ? (
                          <ShieldCheck className="w-3 h-3" />
                        ) : u.role === 'SELLER' ? (
                          <Store className="w-3 h-3" />
                        ) : (
                          <User className="w-3 h-3" />
                        )}
                        <span>{u.role}</span>
                      </span>
                    </td>
                    <td className="py-3 pr-4">
                      {u.telegram_id ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                          <CheckCircle2 className="w-3 h-3" />
                          <span>Connected ({u.telegram_id})</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[11px] text-neutral-400">
                          <XCircle className="w-3 h-3" />
                          <span>Not Linked</span>
                        </span>
                      )}
                    </td>
                    <td className="py-3 text-right text-neutral-500 font-mono text-[11px]">
                      {createdDate}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
