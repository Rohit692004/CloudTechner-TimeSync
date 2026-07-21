// Resolves who approves a given employee's hours on a given project, for the
// per-project approval flow. Order:
//   1. Explicit Approver Override (if set) -- manual escape hatch, wins.
//   2. The project's Project Manager (unless that's the submitter themselves).
//   3. If the submitter IS the project's PM -> the Client Manager of that
//      project's client (unless that's also the submitter).
//   4. The submitter's Reporting Manager (fallback when there's no usable PM).
// Returns null if nothing valid resolves (submission is then blocked, same as
// the old flow's "no approver configured" guard). Never returns the submitter.
export function resolveProjectApprover(params: {
  employeeId: string;
  approverOverrideId: string | null;
  reportingManagerId: string | null;
  projectManagerId: string | null;
  clientManagerId: string | null;
}): string | null {
  const { employeeId, approverOverrideId, reportingManagerId, projectManagerId, clientManagerId } = params;
  const notSelf = (id: string | null | undefined): id is string => !!id && id !== employeeId;

  if (notSelf(approverOverrideId)) return approverOverrideId;
  if (notSelf(projectManagerId)) return projectManagerId;
  if (projectManagerId === employeeId && notSelf(clientManagerId)) return clientManagerId;
  if (notSelf(reportingManagerId)) return reportingManagerId;
  return null;
}

const SELF_MANAGED_INTERNAL_APPROVAL = {
  employeeId: "CT002",
  projectName: "CT IND Internal",
} as const;

export function isSelfManagedInternalApproval(params: {
  employeeId: string;
  projectName: string;
  projectManagerId: string | null;
}): boolean {
  return (
    params.employeeId === SELF_MANAGED_INTERNAL_APPROVAL.employeeId &&
    params.projectName === SELF_MANAGED_INTERNAL_APPROVAL.projectName &&
    params.projectManagerId === params.employeeId
  );
}
