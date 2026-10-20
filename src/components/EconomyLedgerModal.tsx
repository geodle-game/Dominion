import React from 'react';
import { EconomicLedger, Kingdom } from '../types/game';
import { BarChart3, TrendingUp, TrendingDown, Coins, Wheat, Hammer, Shield, Users, ArrowUpRight } from 'lucide-react';
import { sounds } from '../audio/soundManager';

interface EconomyLedgerModalProps {
  player: Kingdom;
  ledger: EconomicLedger;
  onSetPolicy: (policy: Kingdom['taxPolicy']) => void;
  onClose: () => void;
}

export const EconomyLedgerModal: React.FC<EconomyLedgerModalProps> = ({
  player,
  ledger,
  onSetPolicy,
  onClose,
}) => {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-none select-none">
      <div className="relative w-full max-w-3xl rounded-2xl border border-slate-700 bg-slate-900 text-slate-100 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 bg-slate-950/60 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/20 border border-amber-500/40 text-amber-400">
              <BarChart3 className="h-6 w-6" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-100">Imperial Ministry of the Treasury</h2>
              <p className="text-xs text-slate-400">Macroeconomic ledger, revenue balances, and imperial fiscal decrees</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white transition cursor-pointer"
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Top 3 KPI Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Gold Balance */}
            <div className="rounded-xl border border-slate-800 bg-slate-950/50 p-4">
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span className="flex items-center gap-1.5 font-medium">
                  <Coins className="h-4 w-4 text-amber-400" /> Treasury Flow
                </span>
                <span className="text-[10px] font-mono text-slate-500">Per Turn</span>
              </div>
              <div className="mt-2 flex items-baseline gap-2">
                <span className={`text-2xl font-bold font-mono ${ledger.netGold >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {ledger.netGold >= 0 ? `+${ledger.netGold}` : ledger.netGold}
                </span>
                <span className="text-xs text-slate-400">Gold/t (Vault: {player.gold})</span>
              </div>
              <div className="mt-3 flex justify-between text-[11px] text-slate-400 border-t border-slate-800/80 pt-2 font-mono">
                <span>Revenue: +{ledger.goldIncome}</span>
                <span>Upkeep: -{ledger.goldExpenses}</span>
              </div>
            </div>

            {/* Food Balance */}
            <div className="rounded-xl border border-slate-800 bg-slate-950/50 p-4">
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span className="flex items-center gap-1.5 font-medium">
                  <Wheat className="h-4 w-4 text-emerald-400" /> Agrarian Harvest
                </span>
                <span className="text-[10px] font-mono text-slate-500">Per Turn</span>
              </div>
              <div className="mt-2 flex items-baseline gap-2">
                <span className={`text-2xl font-bold font-mono ${ledger.netFood >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {ledger.netFood >= 0 ? `+${ledger.netFood}` : ledger.netFood}
                </span>
                <span className="text-xs text-slate-400">Food/t (Stockpile: {player.food})</span>
              </div>
              <div className="mt-3 flex justify-between text-[11px] text-slate-400 border-t border-slate-800/80 pt-2 font-mono">
                <span>Harvest: +{ledger.foodIncome}</span>
                <span>Rations: -{ledger.foodExpenses}</span>
              </div>
            </div>

            {/* Industrial Production */}
            <div className="rounded-xl border border-slate-800 bg-slate-950/50 p-4">
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span className="flex items-center gap-1.5 font-medium">
                  <Hammer className="h-4 w-4 text-sky-400" /> Industrial Output
                </span>
                <span className="text-[10px] font-mono text-slate-500">Active</span>
              </div>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-2xl font-bold font-mono text-sky-400">
                  {ledger.totalProduction}
                </span>
                <span className="text-xs text-slate-400">Hammers / turn</span>
              </div>
              <div className="mt-3 flex justify-between text-[11px] text-slate-400 border-t border-slate-800/80 pt-2 font-mono">
                <span>Working Pop: {ledger.workingPopulation}</span>
                <span>Iron: {player.iron}</span>
              </div>
            </div>
          </div>

          {/* Revenue and Expense Breakdown Tables */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Revenue */}
            <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-4">
              <div className="flex items-center gap-2 text-xs font-bold text-emerald-400 mb-3 uppercase tracking-wider">
                <TrendingUp className="h-4 w-4" />
                <span>Revenue Streams (+{ledger.goldIncome} Gold)</span>
              </div>
              <div className="space-y-2 text-xs">
                {ledger.incomeBreakdown.map((item, idx) => (
                  <div key={idx} className="flex justify-between border-b border-slate-800/60 pb-1.5">
                    <span className="text-slate-300">{item.source}</span>
                    <span className="font-mono font-bold text-emerald-400">+{item.amount}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Expenses */}
            <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-4">
              <div className="flex items-center gap-2 text-xs font-bold text-rose-400 mb-3 uppercase tracking-wider">
                <TrendingDown className="h-4 w-4" />
                <span>Empire Expenditures (-{ledger.goldExpenses} Gold)</span>
              </div>
              <div className="space-y-2 text-xs">
                {ledger.expenseBreakdown.length > 0 ? (
                  ledger.expenseBreakdown.map((item, idx) => (
                    <div key={idx} className="flex justify-between border-b border-slate-800/60 pb-1.5">
                      <span className="text-slate-300">{item.source}</span>
                      <span className="font-mono font-bold text-rose-400">-{item.amount}</span>
                    </div>
                  ))
                ) : (
                  <div className="text-xs text-slate-500 py-2">No active military or building upkeeps</div>
                )}
              </div>
            </div>
          </div>

          {/* Fiscal Policy Selector (Victoria 3 Influence) */}
          <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-5">
            <h3 className="font-bold text-sm text-slate-200 mb-1">Crown Economic & Fiscal Policies</h3>
            <p className="text-xs text-slate-400 mb-4">
              Enacting national decrees adjusts taxation, tariff barriers, and military mobilization across the realm.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {/* Balanced Policy */}
              <button
                onClick={() => {
                  sounds.playSelect();
                  onSetPolicy('balanced');
                }}
                className={`rounded-xl border p-3 text-left transition cursor-pointer ${
                  player.taxPolicy === 'balanced'
                    ? 'border-amber-500 bg-amber-500/10 text-amber-200 shadow'
                    : 'border-slate-800 bg-slate-900/60 text-slate-400 hover:border-slate-700 hover:text-slate-200'
                }`}
              >
                <div className="font-bold text-xs">Balanced Growth</div>
                <div className="text-[11px] text-slate-400 mt-1">Standard taxation and steady agricultural expansion.</div>
                <div className="mt-2 text-[10px] text-emerald-400 font-mono">Neutral multipliers</div>
              </button>

              {/* War Economy */}
              <button
                onClick={() => {
                  sounds.playSelect();
                  onSetPolicy('war_economy');
                }}
                className={`rounded-xl border p-3 text-left transition cursor-pointer ${
                  player.taxPolicy === 'war_economy'
                    ? 'border-rose-500 bg-rose-500/10 text-rose-200 shadow'
                    : 'border-slate-800 bg-slate-900/60 text-slate-400 hover:border-slate-700 hover:text-slate-200'
                }`}
              >
                <div className="font-bold text-xs">War Mobilization</div>
                <div className="text-[11px] text-slate-400 mt-1">Requisitioning for the imperial armies.</div>
                <div className="mt-2 text-[10px] text-amber-400 font-mono">+30% Gold, +35% Prod, -25% Food</div>
              </button>

              {/* Free Trade */}
              <button
                onClick={() => {
                  sounds.playSelect();
                  onSetPolicy('free_trade');
                }}
                className={`rounded-xl border p-3 text-left transition cursor-pointer ${
                  player.taxPolicy === 'free_trade'
                    ? 'border-sky-500 bg-sky-500/10 text-sky-200 shadow'
                    : 'border-slate-800 bg-slate-900/60 text-slate-400 hover:border-slate-700 hover:text-slate-200'
                }`}
              >
                <div className="font-bold text-xs">Mercantile Trade</div>
                <div className="text-[11px] text-slate-400 mt-1">Abolish guild tariffs to invite foreign merchants.</div>
                <div className="mt-2 text-[10px] text-sky-400 font-mono">+45% Gold, +15% Food, -20% Prod</div>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
