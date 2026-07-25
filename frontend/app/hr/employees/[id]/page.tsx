import { EmployeeForm } from "@/components/resource-pages";
export default async function Page({params}:{params:Promise<{id:string}>}){const {id}=await params;return <EmployeeForm employeeId={Number(id)} role="hr"/>}
