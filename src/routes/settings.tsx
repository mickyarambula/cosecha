import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/input";
import { COMPANY } from "@/lib/company";

type Search = { tab?: string };
export const Route = createFileRoute("/settings")({
  validateSearch: (s: Record<string, unknown>): Search => ({
    tab: typeof s.tab === "string" ? s.tab : "teams",
  }),
  component: Page,
});

const SELLER = [
  "View only my sales orders",
  "Create sales orders",
  "Edit sales orders before they are fulfilled",
  "Edit sales orders after they are fulfilled",
  "Edit sales orders after payments have been applied",
  "Edit cash sales orders",
  "Edit terms sales orders after cutoff time",
  "Edit lot assignments and picked quantities",
  "Mark sales orders as fulfilled",
  "Mark sales orders as unfulfilled",
  "View sales by all salespeople in pricing intelligence",
  "View prices on sales orders",
  "Edit prices on sales orders",
  "Edit sales rep on sales orders",
  "Create credit invoices",
  "Edit credit invoices",
];

function Page() {
  const { tab } = Route.useSearch();
  const [perms, setPerms] = useState(false);

  if (tab === "inventory") {
    return (
      <div className="mx-auto max-w-3xl p-6">
        <p className="label-caps">Inventory management</p>
        <div className="mt-4 space-y-8">
          <Setting
            title="Allow deactivating inventory items with open lots"
            body="Deactivating such inventories will automatically close any open lots belonging to it and waste remaining O/H quantities. Pending transfers will also be cancelled."
          >
            <span className="inline-flex h-6 w-11 items-center rounded-full bg-surface-2 p-0.5">
              <span className="size-5 rounded-full bg-white shadow" />
            </span>
          </Setting>
          <Setting
            title="Days after which to auto-deactivate empty inventory items"
            body='Specify the number of days after which an inventory item with no open lots and no O/H quantity should be automatically deactivated. Set to "-1" to opt out.'
          >
            <Input className="w-40" />
          </Setting>
          <Setting
            title="Days after which to auto-close received lots with 0 O/H"
            body="Automatic closing occurs once a day, so you may need to wait a day to see updates."
          >
            <Input className="w-40" />
          </Setting>
          <Setting title="Repack pack date default" body="Select the default date that should appear in the Pack Date field for each output lot when creating a repack.">
            <Select defaultValue="Current date" className="w-48">
              <option>Earliest pack date</option>
              <option>Current date</option>
              <option>No default date</option>
            </Select>
          </Setting>
          <p className="label-caps pt-4">Purchases</p>
          <Setting title="Purchase lot number generation method" body="Select how lot numbers will be generated for items on purchase orders. Sequential uses the first three letters of the product name plus a counter. PO # Prefaced combines the PO number with those letters.">
            <Select defaultValue="PO # Prefaced" className="w-48">
              <option>Sequential</option>
              <option>PO # Prefaced</option>
            </Select>
          </Setting>
        </div>
      </div>
    );
  }

  if (tab === "business") {
    return (
      <div className="mx-auto max-w-xl p-6">
        <Field label="Legal name">
          <Input defaultValue={COMPANY.legalName} />
        </Field>
        <Field label="City" className="mt-3">
          <Input defaultValue={COMPANY.city} />
        </Field>
        <Field label="Country" className="mt-3">
          <Input defaultValue={COMPANY.country} />
        </Field>
        <Button className="mt-4">Save</Button>
      </div>
    );
  }

  if (tab === "features") {
    return (
      <div className="p-6">
        <SellerTable />
      </div>
    );
  }

  if (perms) {
    return (
      <div className="p-6">
        {perms ? (
          <button type="button" className="mb-4 text-sm text-link" onClick={() => setPerms(false)}>
            ← Back to teams
          </button>
        ) : null}
        <SellerTable />
      </div>
    );
  }

  if (tab === "orders") {
    return (
      <div className="mx-auto max-w-3xl space-y-8 p-6">
        <Setting title="Print order when placed" body="Automatically open a printable purchase order after Place order.">
          <span className="inline-flex h-6 w-11 items-center rounded-full bg-surface-2 p-0.5">
            <span className="size-5 rounded-full bg-white shadow" />
          </span>
        </Setting>
        <Setting title="Share vendor portal by default" body="When placing a PO, pre-check Share vendor portal to contacts.">
          <span className="inline-flex h-6 w-11 items-center rounded-full bg-action p-0.5">
            <span className="ml-auto size-5 rounded-full bg-white shadow" />
          </span>
        </Setting>
        <Setting title="Auto-fulfill sales orders" body="Mark sales orders fulfilled when lot assignment covers every line.">
          <span className="inline-flex h-6 w-11 items-center rounded-full bg-action p-0.5">
            <span className="ml-auto size-5 rounded-full bg-white shadow" />
          </span>
        </Setting>
      </div>
    );
  }

  if (tab === "accounting") {
    return (
      <div className="mx-auto max-w-3xl space-y-8 p-6">
        <Setting title="PACA trust language on invoices" body="Print the statutory trust notice on customer invoices.">
          <span className="inline-flex h-6 w-11 items-center rounded-full bg-action p-0.5">
            <span className="ml-auto size-5 rounded-full bg-white shadow" />
          </span>
        </Setting>
        <Setting title="Default customer terms (Net D)" body="Used when a new customer is created without terms.">
          <Input className="w-24" defaultValue="0" />
        </Setting>
        <Setting title="Include expenses in break-even" body="Distribute connected PO expenses into lot B/E.">
          <span className="inline-flex h-6 w-11 items-center rounded-full bg-action p-0.5">
            <span className="ml-auto size-5 rounded-full bg-white shadow" />
          </span>
        </Setting>
      </div>
    );
  }

  if (tab === "departments") {
    return (
      <div className="p-6">
        <p className="mb-3 text-sm text-muted">Departments group sales for the Sales by Department report.</p>
        <div className="max-w-lg rounded-lg border border-border bg-surface">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <span className="font-medium">Uncategorized</span>
            <span className="text-xs text-muted">Default</span>
          </div>
          <button type="button" className="px-4 py-3 text-sm text-link">
            + Add department
          </button>
        </div>
      </div>
    );
  }

  if (tab === "online") {
    return (
      <div className="mx-auto max-w-3xl space-y-8 p-6">
        <Setting title="Enable online ordering" body="Customers can submit orders from the price-sheet portal.">
          <span className="inline-flex h-6 w-11 items-center rounded-full bg-surface-2 p-0.5">
            <span className="size-5 rounded-full bg-white shadow" />
          </span>
        </Setting>
        <Setting title="Require customer PO #" body="Online orders cannot be submitted without a PO number.">
          <span className="inline-flex h-6 w-11 items-center rounded-full bg-surface-2 p-0.5">
            <span className="size-5 rounded-full bg-white shadow" />
          </span>
        </Setting>
      </div>
    );
  }

  return (
    <div className="p-5">
      <div className="rounded-lg border border-border bg-surface p-4">
        <p className="label-caps">Team</p>
        <h2 className="text-base font-semibold text-link">Admin Team</h2>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-3">
          <div>
            <p className="text-sm font-medium">{COMPANY.userName}</p>
            <p className="text-xs text-muted">{COMPANY.userEmail}</p>
          </div>
          <Button size="sm" variant="outline" onClick={() => setPerms(true)}>
            Edit individual permissions
          </Button>
        </div>
        <div className="mt-3 flex gap-4 text-sm">
          <button type="button" className="text-link">
            Invite new member
          </button>
          <button type="button" className="text-danger">
            Delete team
          </button>
        </div>
      </div>
      <p className="mt-6 text-center text-sm text-link">Add new team</p>
    </div>
  );
}

function SellerTable() {
  return (
    <div className="overflow-x-auto">
      <table className="w-full max-w-xl text-left text-sm">
        <thead className="text-xs text-muted">
          <tr>
            <th className="py-2 font-medium">Seller features</th>
            <th className="py-2 font-medium">Edit/Allow</th>
            <th className="py-2 font-medium">View only</th>
          </tr>
        </thead>
        <tbody>
          {SELLER.map((row) => (
            <tr key={row} className="border-t border-border">
              <td className="py-2">{row}</td>
              <td>
                <input type="checkbox" className="size-4 accent-action" />
              </td>
              <td>
                <input type="checkbox" className="size-4 accent-action" />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Setting({ title, body, children }: { title: string; body: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-3 sm:grid-cols-[12rem_1fr] sm:items-start">
      <div>{children}</div>
      <div>
        <p className="font-medium">{title}</p>
        <p className="mt-1 text-sm text-muted">{body}</p>
      </div>
    </div>
  );
}
