import { Request, Response } from 'express';
import mongoose from 'mongoose';
import { Project } from '../models/Project.js';
import { Client } from '../models/Client.js';
import { WorkAssignment } from '../models/WorkAssignment.js';
import { AuditLog } from '../models/AuditLog.js';

export async function getProjects(req: Request, res: Response): Promise<void> {
  try {
    const { client_id, status } = req.query;
    const filter: any = {};

    if (client_id && mongoose.Types.ObjectId.isValid(client_id as string)) {
      filter.client = client_id;
    }
    if (status) {
      filter.status = status;
    }

    const projects = await Project.find(filter)
      .populate('client', 'name')
      .populate('projectManager', 'firstName lastName username email')
      .sort({ createdAt: -1 });

    const formatted = await Promise.all(
      projects.map(async (p) => {
        const clientObj = p.client as any;
        const managerObj = p.projectManager as any;

        // Count linked tasks & total tracked hours
        const tasks = await WorkAssignment.find({ project: p._id });
        const totalTasks = tasks.length;
        const completedTasks = tasks.filter((t) =>
          ['Completed', 'Approved', 'Published'].includes(t.status)
        ).length;
        const totalEstimatedHours = tasks.reduce((sum, t) => sum + (t.estimatedHours || 0), 0);
        const totalActualHours = tasks.reduce((sum, t) => sum + (t.actualHours || 0), 0);

        return {
          id: p._id,
          name: p.name,
          code: p.code || '',
          description: p.description || '',
          status: p.status,
          client_id: clientObj ? clientObj._id : p.client,
          client_name: clientObj ? clientObj.name : 'Unknown Client',
          project_manager: managerObj
            ? {
                id: managerObj._id,
                name: `${managerObj.firstName || ''} ${managerObj.lastName || ''}`.trim() || managerObj.username,
                email: managerObj.email,
              }
            : null,
          start_date: p.startDate ? p.startDate.toISOString().split('T')[0] : '',
          target_end_date: p.targetEndDate ? p.targetEndDate.toISOString().split('T')[0] : '',
          budget_hours: p.budgetHours || 0,
          total_tasks: totalTasks,
          completed_tasks: completedTasks,
          estimated_hours: totalEstimatedHours,
          actual_hours: totalActualHours,
          progress_percentage: totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0,
          created_at: p.createdAt,
        };
      })
    );

    res.json({
      count: formatted.length,
      next: null,
      previous: null,
      results: formatted,
    });
  } catch (error: any) {
    res.status(500).json({ detail: error.message || 'Failed to fetch projects.' });
  }
}

export async function createProject(req: Request, res: Response): Promise<void> {
  try {
    const { client_id, client, name, code, description, status, start_date, target_end_date, budget_hours, project_manager } = req.body;
    const targetClientId = client_id || client;

    if (!targetClientId || !mongoose.Types.ObjectId.isValid(targetClientId)) {
      res.status(400).json({ detail: 'Valid client ID is required to create a project.' });
      return;
    }
    if (!name || !name.trim()) {
      res.status(400).json({ detail: 'Project name is required.' });
      return;
    }

    const clientExists = await Client.findById(targetClientId);
    if (!clientExists) {
      res.status(404).json({ detail: 'Target client not found.' });
      return;
    }

    const project = new Project({
      client: targetClientId,
      name: name.trim(),
      code: code ? code.trim() : '',
      description: description || '',
      status: status || 'Active',
      startDate: start_date ? new Date(start_date) : null,
      targetEndDate: target_end_date ? new Date(target_end_date) : null,
      budgetHours: budget_hours ? Number(budget_hours) : 0,
      projectManager: project_manager && mongoose.Types.ObjectId.isValid(project_manager) ? project_manager : null,
    });

    await project.save();

    await AuditLog.create({
      actor: req.user?._id || null,
      action: 'PROJECT_CREATED',
      entityType: 'Project',
      entityId: String(project._id),
      details: { name: project.name, client: clientExists.name },
    });

    res.status(201).json(project);
  } catch (error: any) {
    res.status(500).json({ detail: error.message || 'Failed to create project.' });
  }
}

export async function updateProject(req: Request, res: Response): Promise<void> {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      res.status(404).json({ detail: 'Project not found.' });
      return;
    }

    const project = await Project.findById(req.params.id);
    if (!project) {
      res.status(404).json({ detail: 'Project not found.' });
      return;
    }

    const { name, code, description, status, start_date, target_end_date, budget_hours, project_manager } = req.body;

    if (name) project.name = name.trim();
    if (code !== undefined) project.code = code.trim();
    if (description !== undefined) project.description = description;
    if (status) project.status = status;
    if (start_date !== undefined) project.startDate = start_date ? new Date(start_date) : null;
    if (target_end_date !== undefined) project.targetEndDate = target_end_date ? new Date(target_end_date) : null;
    if (budget_hours !== undefined) project.budgetHours = Number(budget_hours);
    if (project_manager !== undefined) {
      project.projectManager = project_manager && mongoose.Types.ObjectId.isValid(project_manager) ? project_manager : null;
    }

    await project.save();

    await AuditLog.create({
      actor: req.user?._id || null,
      action: 'PROJECT_UPDATED',
      entityType: 'Project',
      entityId: String(project._id),
      details: { name: project.name, status: project.status },
    });

    res.json(project);
  } catch (error: any) {
    res.status(500).json({ detail: error.message || 'Failed to update project.' });
  }
}

export async function deleteProject(req: Request, res: Response): Promise<void> {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      res.status(404).json({ detail: 'Project not found.' });
      return;
    }
    const project = await Project.findById(req.params.id);
    if (!project) {
      res.status(404).json({ detail: 'Project not found.' });
      return;
    }

    await Project.findByIdAndDelete(req.params.id);

    await AuditLog.create({
      actor: req.user?._id || null,
      action: 'PROJECT_DELETED',
      entityType: 'Project',
      entityId: String(project._id),
      details: { name: project.name },
    });

    res.status(204).send();
  } catch (error: any) {
    res.status(500).json({ detail: error.message || 'Failed to delete project.' });
  }
}
