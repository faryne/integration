export namespace agent {

	export class ChatLine {
	    type?: string;
	    role?: string;
	    text: string;
	    created_at?: string;
	    task_id?: string;
	    proposal_id?: string;
	    content_hash?: string;
	    event_id?: string;

	    static createFrom(source: any = {}) {
	        return new ChatLine(source);
	    }

	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.type = source["type"];
	        this.role = source["role"];
	        this.text = source["text"];
	        this.created_at = source["created_at"];
	        this.task_id = source["task_id"];
	        this.proposal_id = source["proposal_id"];
	        this.content_hash = source["content_hash"];
	        this.event_id = source["event_id"];
	    }
	}
	export class Thread {
	    id: string;
	    title: string;
	    session_id: string;
	    updated_at: string;
	    last_task_state?: string;
	    active_task_id?: string;

	    static createFrom(source: any = {}) {
	        return new Thread(source);
	    }

	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.title = source["title"];
	        this.session_id = source["session_id"];
	        this.updated_at = source["updated_at"];
	        this.last_task_state = source["last_task_state"];
	        this.active_task_id = source["active_task_id"];
	    }
	}
	export class ChatPage {
	    threads: Thread[];
	    current_id: string;
	    session_id: string;
	    messages: ChatLine[];
	    start: number;
	    total: number;

	    static createFrom(source: any = {}) {
	        return new ChatPage(source);
	    }

	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.threads = this.convertValues(source["threads"], Thread);
	        this.current_id = source["current_id"];
	        this.session_id = source["session_id"];
	        this.messages = this.convertValues(source["messages"], ChatLine);
	        this.start = source["start"];
	        this.total = source["total"];
	    }

		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class Installed {
	    id: string;
	    display_name: string;
	    path: string;

	    static createFrom(source: any = {}) {
	        return new Installed(source);
	    }

	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.display_name = source["display_name"];
	        this.path = source["path"];
	    }
	}
	export class McpHint {
	    installed: boolean;
	    command: string;

	    static createFrom(source: any = {}) {
	        return new McpHint(source);
	    }

	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.installed = source["installed"];
	        this.command = source["command"];
	    }
	}
	export class OlderMessages {
	    messages: ChatLine[];
	    start: number;
	    total: number;

	    static createFrom(source: any = {}) {
	        return new OlderMessages(source);
	    }

	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.messages = this.convertValues(source["messages"], ChatLine);
	        this.start = source["start"];
	        this.total = source["total"];
	    }

		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class ProjectThread {
	    id: string;
	    agent_id: string;
	    title: string;
	    updated_at: string;
	    last_task_state?: string;
	    active_task_id?: string;

	    static createFrom(source: any = {}) {
	        return new ProjectThread(source);
	    }

	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.agent_id = source["agent_id"];
	        this.title = source["title"];
	        this.updated_at = source["updated_at"];
	        this.last_task_state = source["last_task_state"];
	        this.active_task_id = source["active_task_id"];
	    }
	}
	export class ProposalSnapshot {
	    title?: string;
	    summary?: string;
	    content_type?: string;
	    content?: string;

	    static createFrom(source: any = {}) {
	        return new ProposalSnapshot(source);
	    }

	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.title = source["title"];
	        this.summary = source["summary"];
	        this.content_type = source["content_type"];
	        this.content = source["content"];
	    }
	}
	export class ProposalOperation {
	    tool: string;
	    arguments: Record<string, any>;

	    static createFrom(source: any = {}) {
	        return new ProposalOperation(source);
	    }

	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.tool = source["tool"];
	        this.arguments = source["arguments"];
	    }
	}
	export class ProposalItem {
	    id: string;
	    kind: string;
	    operations: ProposalOperation[];
	    target_id?: string;
	    base_version_id?: string;
	    title?: string;
	    summary?: string;
	    content_type?: string;
	    content?: string;
	    base?: ProposalSnapshot;
	    local_path?: string;
	    file_name?: string;
	    mime_type?: string;
	    file_size?: number;
	    file_sha256?: string;
	    alt_text?: string;
	    collection_id?: string;
	    content_hash: string;

	    static createFrom(source: any = {}) {
	        return new ProposalItem(source);
	    }

	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.kind = source["kind"];
	        this.operations = this.convertValues(source["operations"], ProposalOperation);
	        this.target_id = source["target_id"];
	        this.base_version_id = source["base_version_id"];
	        this.title = source["title"];
	        this.summary = source["summary"];
	        this.content_type = source["content_type"];
	        this.content = source["content"];
	        this.base = this.convertValues(source["base"], ProposalSnapshot);
	        this.local_path = source["local_path"];
	        this.file_name = source["file_name"];
	        this.mime_type = source["mime_type"];
	        this.file_size = source["file_size"];
	        this.file_sha256 = source["file_sha256"];
	        this.alt_text = source["alt_text"];
	        this.collection_id = source["collection_id"];
	        this.content_hash = source["content_hash"];
	    }

		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class Proposal {
	    id: string;
	    task_id: string;
	    thread_id: string;
	    agent_id: string;
	    project_id: string;
	    status: string;
	    content_hash: string;
	    created_at: string;
	    decided_at?: string;
	    grant_id?: string;
	    grant_expires_at?: string;
	    applied_at?: string;
	    interrupted_at?: string;
	    items: ProposalItem[];

	    static createFrom(source: any = {}) {
	        return new Proposal(source);
	    }

	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.task_id = source["task_id"];
	        this.thread_id = source["thread_id"];
	        this.agent_id = source["agent_id"];
	        this.project_id = source["project_id"];
	        this.status = source["status"];
	        this.content_hash = source["content_hash"];
	        this.created_at = source["created_at"];
	        this.decided_at = source["decided_at"];
	        this.grant_id = source["grant_id"];
	        this.grant_expires_at = source["grant_expires_at"];
	        this.applied_at = source["applied_at"];
	        this.interrupted_at = source["interrupted_at"];
	        this.items = this.convertValues(source["items"], ProposalItem);
	    }

		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}



	export class Reply {
	    session_id: string;
	    text: string;
	    thread_id: string;
	    title: string;

	    static createFrom(source: any = {}) {
	        return new Reply(source);
	    }

	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.session_id = source["session_id"];
	        this.text = source["text"];
	        this.thread_id = source["thread_id"];
	        this.title = source["title"];
	    }
	}
	export class Request {
	    thread_id: string;
	    session_id: string;
	    project_id: string;
	    kind: string;
	    document_id: string;
	    title: string;
	    prompt: string;

	    static createFrom(source: any = {}) {
	        return new Request(source);
	    }

	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.thread_id = source["thread_id"];
	        this.session_id = source["session_id"];
	        this.project_id = source["project_id"];
	        this.kind = source["kind"];
	        this.document_id = source["document_id"];
	        this.title = source["title"];
	        this.prompt = source["prompt"];
	    }
	}
	export class Task {
	    id: string;
	    agent_id: string;
	    project_id: string;
	    thread_id: string;
	    prompt: string;
	    state: string;
	    error?: string;
	    created_at: string;
	    started_at?: string;
	    finished_at?: string;
	    partial?: string;
	    activity?: string;

	    static createFrom(source: any = {}) {
	        return new Task(source);
	    }

	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.agent_id = source["agent_id"];
	        this.project_id = source["project_id"];
	        this.thread_id = source["thread_id"];
	        this.prompt = source["prompt"];
	        this.state = source["state"];
	        this.error = source["error"];
	        this.created_at = source["created_at"];
	        this.started_at = source["started_at"];
	        this.finished_at = source["finished_at"];
	        this.partial = source["partial"];
	        this.activity = source["activity"];
	    }
	}

}

export namespace api {

	export class Document {
	    kind: string;
	    public_id: string;
	    title: string;
	    summary: string;
	    status: string;
	    content_type: string;
	    latest_content: string;
	    latest_version_id?: number;
	    word_count: number;
	    updated_at: string;

	    static createFrom(source: any = {}) {
	        return new Document(source);
	    }

	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.kind = source["kind"];
	        this.public_id = source["public_id"];
	        this.title = source["title"];
	        this.summary = source["summary"];
	        this.status = source["status"];
	        this.content_type = source["content_type"];
	        this.latest_content = source["latest_content"];
	        this.latest_version_id = source["latest_version_id"];
	        this.word_count = source["word_count"];
	        this.updated_at = source["updated_at"];
	    }
	}
	export class DocumentItem {
	    kind: string;
	    public_id: string;
	    title: string;
	    content_type: string;

	    static createFrom(source: any = {}) {
	        return new DocumentItem(source);
	    }

	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.kind = source["kind"];
	        this.public_id = source["public_id"];
	        this.title = source["title"];
	        this.content_type = source["content_type"];
	    }
	}
	export class Group {
	    public_id: string;
	    name: string;
	    items: DocumentItem[];

	    static createFrom(source: any = {}) {
	        return new Group(source);
	    }

	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.public_id = source["public_id"];
	        this.name = source["name"];
	        this.items = this.convertValues(source["items"], DocumentItem);
	    }

		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class Profile {
	    pen_name: string;
	    avatar_url: string;

	    static createFrom(source: any = {}) {
	        return new Profile(source);
	    }

	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.pen_name = source["pen_name"];
	        this.avatar_url = source["avatar_url"];
	    }
	}
	export class Project {
	    public_id: string;
	    name: string;
	    description: string;
	    visibility: string;
	    cover_url: string;
	    story_count: number;
	    word_count: number;
	    updated_at: string;

	    static createFrom(source: any = {}) {
	        return new Project(source);
	    }

	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.public_id = source["public_id"];
	        this.name = source["name"];
	        this.description = source["description"];
	        this.visibility = source["visibility"];
	        this.cover_url = source["cover_url"];
	        this.story_count = source["story_count"];
	        this.word_count = source["word_count"];
	        this.updated_at = source["updated_at"];
	    }
	}
	export class Version {
	    id: number;
	    title: string;
	    source: string;
	    word_count: number;
	    reverted_from_version_id?: number;
	    conflicted_with_version_id?: number;
	    created_at: string;

	    static createFrom(source: any = {}) {
	        return new Version(source);
	    }

	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.title = source["title"];
	        this.source = source["source"];
	        this.word_count = source["word_count"];
	        this.reverted_from_version_id = source["reverted_from_version_id"];
	        this.conflicted_with_version_id = source["conflicted_with_version_id"];
	        this.created_at = source["created_at"];
	    }
	}
	export class VersionDetail {
	    id: number;
	    title: string;
	    summary: string;
	    content: string;
	    source: string;
	    created_at: string;

	    static createFrom(source: any = {}) {
	        return new VersionDetail(source);
	    }

	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.title = source["title"];
	        this.summary = source["summary"];
	        this.content = source["content"];
	        this.source = source["source"];
	        this.created_at = source["created_at"];
	    }
	}
	export class Workspace {
	    volumes: Group[];
	    ungrouped_stories: DocumentItem[];
	    lore_collections: Group[];
	    uncategorized_lores: DocumentItem[];
	    asset_collections: Group[];

	    static createFrom(source: any = {}) {
	        return new Workspace(source);
	    }

	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.volumes = this.convertValues(source["volumes"], Group);
	        this.ungrouped_stories = this.convertValues(source["ungrouped_stories"], DocumentItem);
	        this.lore_collections = this.convertValues(source["lore_collections"], Group);
	        this.uncategorized_lores = this.convertValues(source["uncategorized_lores"], DocumentItem);
	        this.asset_collections = this.convertValues(source["asset_collections"], Group);
	    }

		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}

}

export namespace skillupdate {

	export class Result {
	    version: string;
	    updated: boolean;

	    static createFrom(source: any = {}) {
	        return new Result(source);
	    }

	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.version = source["version"];
	        this.updated = source["updated"];
	    }
	}

}

export namespace updater {

	export class Info {
	    current_version: string;
	    version: string;

	    static createFrom(source: any = {}) {
	        return new Info(source);
	    }

	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.current_version = source["current_version"];
	        this.version = source["version"];
	    }
	}

}

