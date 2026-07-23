import { EmployeeForm } from "@/components/resource-pages"; import { employees } from "@/lib/demo-data";
export default async function Page({params}:{params:Promise<{id:string}>}){const {id}=await params;return <EmployeeForm employee={employees.find(x=>x.id===Number(id))||employees[0]}/>}
