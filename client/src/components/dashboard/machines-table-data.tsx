"use client";

import { use } from "react";
import { MachinesTable } from "./machines-table";

interface MachinesTableDataProps {
  machinesDataPromise: Promise<any>
}

export function MachinesTableData({ machinesDataPromise }: MachinesTableDataProps) {
  const machines = use(machinesDataPromise);
  return <MachinesTable machines={machines} />;
}
