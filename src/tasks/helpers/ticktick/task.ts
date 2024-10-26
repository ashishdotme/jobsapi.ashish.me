export interface Task {
    id: string;
    projectId: string;
    title: string;
    allDay?: boolean;
    completedTime?: string; 
    content?: string;
    desc?: string;
    dueDate?: string; 
    items?: Subtask[];
    priority?: 0 | 1 | 3 | 5;
    reminders?: string[];
    repeat?: string;
    sortOrder?: number;
    startDate?: string; 
    status?: 0 | 1 | 2;
    timeZone?: string;
    taskUrl: string;
}

export interface Subtask {
    id?: string;
    title: string;
    status?: 0 | 1;
    completedTime?: string; 
    isAllDay?: boolean;
    sortOrder?: number; 
    startDate?: string; 
    timeZone?: string; 
}  

export interface NewTask extends Partial<Task> {
    title: string;
}