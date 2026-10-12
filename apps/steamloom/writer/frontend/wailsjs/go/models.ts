export namespace agent {
	
	export class ChatLine {
	    role: string;
	    text: string;
	
	    static createFrom(source: any = {}) {
	        return new ChatLine(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.role = source["role"];
	        this.text = source["text"];
	    }
	}
	export class Thread {
	    id: string;
	    title: string;
	    session_id: string;
	    updated_at: string;
	
	    static createFrom(source: any = {}) {
	        return new Thread(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.title = source["title"];
	        this.session_id = source["session_id"];
	        this.updated_at = source["updated_at"];
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

