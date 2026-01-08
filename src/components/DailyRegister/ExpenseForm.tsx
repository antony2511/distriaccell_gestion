import React, { useState } from 'react';
import { Expense, ExpenseCategory } from '../../types';
import { EXPENSE_CATEGORIES } from '../../constants/categories';
import { formatCurrency } from '../../utils/currency';
import { groupExpensesByCategory } from '../../utils/calculations';

interface ExpenseFormProps {
  expenses: Expense[];
  onAddExpense: (expense: Omit<Expense, 'id' | 'timestamp'>) => void;
  onRemoveExpense: (id: string) => void;
  disabled?: boolean;
}

interface TempExpense {
  tempId: string;
  category: ExpenseCategory;
  concept: string;
  amount: number;
  responsiblePerson: string;
}

const ExpenseForm: React.FC<ExpenseFormProps> = ({ expenses, onAddExpense, onRemoveExpense, disabled }) => {
  const [tempExpenses, setTempExpenses] = useState<TempExpense[]>([{
    tempId: Date.now().toString(),
    category: 'insumos' as ExpenseCategory,
    concept: '',
    amount: 0,
    responsiblePerson: ''
  }]);

  const addNewLine = () => {
    setTempExpenses([...tempExpenses, {
      tempId: Date.now().toString(),
      category: 'insumos',
      concept: '',
      amount: 0,
      responsiblePerson: ''
    }]);
  };

  const removeLine = (tempId: string) => {
    if (tempExpenses.length === 1) return;
    setTempExpenses(tempExpenses.filter(e => e.tempId !== tempId));
  };

  const updateLine = (tempId: string, field: keyof TempExpense, value: any) => {
    setTempExpenses(tempExpenses.map(e =>
      e.tempId === tempId ? { ...e, [field]: value } : e
    ));
  };

  const handleAddAll = () => {
    const validExpenses = tempExpenses.filter(e => e.concept && e.amount > 0);

    if (validExpenses.length === 0) {
      alert('⚠️ Agrega al menos un gasto con concepto y monto válido');
      return;
    }

    validExpenses.forEach(expense => {
      onAddExpense({
        category: expense.category,
        concept: expense.concept,
        amount: expense.amount,
        responsiblePerson: expense.responsiblePerson || undefined
      });
    });

    setTempExpenses([{
      tempId: Date.now().toString(),
      category: 'insumos',
      concept: '',
      amount: 0,
      responsiblePerson: ''
    }]);
  };

  const total = expenses.reduce((acc, exp) => acc + exp.amount, 0);
  const tempTotal = tempExpenses.reduce((acc, e) => acc + e.amount, 0);
  const expensesByCategory = groupExpensesByCategory(expenses);

  return (
    <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-slate-100 dark:border-slate-700 bg-red-50/50 dark:bg-red-900/10 flex items-center gap-2">
        <span className="material-symbols-outlined text-red-600">trending_down</span>
        <h3 className="font-bold text-sm">💸 Gastos Operativos</h3>
      </div>

      {/* Form - Multiple lines */}
      <div className="p-5 border-b border-slate-100 dark:border-slate-700 bg-red-50/20 dark:bg-red-900/5 space-y-3">
        <div className="flex items-center justify-between mb-2">
          <label className="block text-xs font-black text-slate-400 uppercase tracking-widest">
            💸 Gastos a agregar
          </label>
          <button
            onClick={addNewLine}
            disabled={disabled}
            className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition-colors disabled:opacity-50"
          >
            <span className="material-symbols-outlined text-sm">add</span>
            Nueva línea
          </button>
        </div>

        {/* Expense lines */}
        <div className="space-y-2">
          {tempExpenses.map((expense) => (
            <div key={expense.tempId} className="bg-white dark:bg-slate-700 p-3 rounded-lg border border-slate-200 dark:border-slate-600 space-y-2">
              <div className="grid grid-cols-1 md:grid-cols-12 gap-2 items-center">
                <div className="md:col-span-3">
                  <select
                    value={expense.category}
                    onChange={(e) => updateLine(expense.tempId, 'category', e.target.value as ExpenseCategory)}
                    disabled={disabled}
                    className="w-full h-10 text-xs rounded-lg border-slate-200 dark:border-slate-500 dark:bg-slate-600 focus:ring-2 focus:ring-red-500 disabled:opacity-50"
                  >
                    {EXPENSE_CATEGORIES.map((cat) => (
                      <option key={cat.id} value={cat.id}>
                        {cat.icon} {cat.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="md:col-span-4">
                  <input
                    type="text"
                    value={expense.concept}
                    onChange={(e) => updateLine(expense.tempId, 'concept', e.target.value)}
                    placeholder="Concepto del gasto"
                    disabled={disabled}
                    className="w-full h-10 text-sm rounded-lg border-slate-200 dark:border-slate-500 dark:bg-slate-600 focus:ring-2 focus:ring-red-500 disabled:opacity-50"
                    maxLength={100}
                  />
                </div>

                <div className="md:col-span-2">
                  <input
                    type="number"
                    value={expense.amount || ''}
                    onChange={(e) => updateLine(expense.tempId, 'amount', parseFloat(e.target.value) || 0)}
                    placeholder="Monto"
                    disabled={disabled}
                    className="w-full h-10 text-sm rounded-lg border-slate-200 dark:border-slate-500 dark:bg-slate-600 text-right font-bold focus:ring-2 focus:ring-red-500 disabled:opacity-50"
                    min="0"
                    step="1000"
                  />
                </div>

                <div className="md:col-span-2">
                  <input
                    type="text"
                    value={expense.responsiblePerson}
                    onChange={(e) => updateLine(expense.tempId, 'responsiblePerson', e.target.value)}
                    placeholder="Responsable"
                    disabled={disabled}
                    className="w-full h-10 text-sm rounded-lg border-slate-200 dark:border-slate-500 dark:bg-slate-600 focus:ring-2 focus:ring-red-500 disabled:opacity-50"
                  />
                </div>

                <div className="md:col-span-1 flex justify-end">
                  {tempExpenses.length > 1 && (
                    <button
                      onClick={() => removeLine(expense.tempId)}
                      disabled={disabled}
                      className="text-slate-400 hover:text-red-500 transition-colors disabled:opacity-50"
                    >
                      <span className="material-symbols-outlined text-lg">delete</span>
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Total preview and submit button */}
        <div className="flex items-center justify-between pt-3 border-t border-slate-200 dark:border-slate-600">
          <div>
            <span className="text-xs text-slate-500">Total a agregar: </span>
            <span className="text-lg font-black text-red-600 dark:text-red-400">
              {formatCurrency(tempTotal)}
            </span>
          </div>
          <button
            onClick={handleAddAll}
            disabled={disabled || tempExpenses.every(e => !e.concept || e.amount <= 0)}
            className="px-6 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-lg font-bold flex items-center gap-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <span className="material-symbols-outlined">check_circle</span>
            Agregar Todo
          </button>
        </div>
      </div>

      {/* Expenses grouped by category */}
      <div className="p-5 space-y-3 max-h-96 overflow-y-auto custom-scrollbar">
        {Object.entries(expensesByCategory).map(([category, categoryTotal]) => {
          const categoryExpenses = expenses.filter(e => e.category === category);
          const categoryInfo = EXPENSE_CATEGORIES.find(c => c.id === category);

          return (
            <div key={category} className="border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
              {/* Category header */}
              <div className="bg-slate-50 dark:bg-slate-900/50 p-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-lg">{categoryInfo?.icon}</span>
                  <span className="text-xs font-bold">{categoryInfo?.label}</span>
                  <span className="text-xs text-slate-500">({categoryExpenses.length})</span>
                </div>
                <span className="font-black text-red-600">{formatCurrency(categoryTotal)}</span>
              </div>

              {/* Expenses in category */}
              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {categoryExpenses.map((expense) => (
                  <div
                    key={expense.id}
                    className="group p-3 hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors flex items-center justify-between"
                  >
                    <div className="flex-1">
                      <p className="text-sm font-medium">{expense.concept}</p>
                      {expense.responsiblePerson && (
                        <p className="text-xs text-slate-500 mt-0.5">Por: {expense.responsiblePerson}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-3">
                      <p className="font-mono font-bold text-red-600">{formatCurrency(expense.amount)}</p>
                      <button
                        onClick={() => onRemoveExpense(expense.id)}
                        disabled={disabled}
                        className="text-slate-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all disabled:opacity-0"
                      >
                        <span className="material-symbols-outlined text-lg">delete</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}

        {expenses.length === 0 && (
          <div className="text-center py-8 text-slate-400">
            <span className="material-symbols-outlined text-5xl mb-2 opacity-20">receipt</span>
            <p className="text-sm">No hay gastos registrados para hoy</p>
          </div>
        )}
      </div>

      {/* Footer with total */}
      <div className="p-5 bg-red-50 dark:bg-red-900/20 border-t border-red-200 dark:border-red-800 flex justify-between items-center">
        <span className="text-sm font-bold text-red-700 dark:text-red-400">
          Total gastos operativos:
        </span>
        <span className="text-2xl font-black text-red-600 dark:text-red-400 tabular-nums">
          {formatCurrency(total)}
        </span>
      </div>
    </div>
  );
};

export default ExpenseForm;
