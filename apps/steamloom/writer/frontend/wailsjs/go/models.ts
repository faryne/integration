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
	
	export class Asset {
	    public_id: string;
	    collection_id: string;
	    asset_type: string;
	    mime_type: string;
	    file_ext: string;
	    file_size: number;
	    metadata: Record<string, any>;
	    original_filename: string;
	    title: string;
	    alt_text: string;
	    description: string;
	    preview_url: string;
	    reference_count: number;
	    created_at: string;
	    updated_at: string;
	
	    static createFrom(source: any = {}) {
	        return new Asset(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.public_id = source["public_id"];
	        this.collection_id = source["collection_id"];
	        this.asset_type = source["asset_type"];
	        this.mime_type = source["mime_type"];
	        this.file_ext = source["file_ext"];
	        this.file_size = source["file_size"];
	        this.metadata = source["metadata"];
	        this.original_filename = source["original_filename"];
	        this.title = source["title"];
	        this.alt_text = source["alt_text"];
	        this.description = source["description"];
	        this.preview_url = source["preview_url"];
	        this.reference_count = source["reference_count"];
	        this.created_at = source["created_at"];
	        this.updated_at = source["updated_at"];
	    }
	}
	export class AssetInput {
	    title: string;
	    alt_text: string;
	    description: string;
	    metadata: Record<string, any>;
	
	    static createFrom(source: any = {}) {
	        return new AssetInput(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.title = source["title"];
	        this.alt_text = source["alt_text"];
	        this.description = source["description"];
	        this.metadata = source["metadata"];
	    }
	}
	export class AssetPage {
	    assets: Asset[];
	    total_count: number;
	    page: number;
	    page_size: number;
	
	    static createFrom(source: any = {}) {
	        return new AssetPage(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.assets = this.convertValues(source["assets"], Asset);
	        this.total_count = source["total_count"];
	        this.page = source["page"];
	        this.page_size = source["page_size"];
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
	export class AttributePatch {
	    status?: string;
	    group_id?: string;
	    profile_ids?: number[];
	
	    static createFrom(source: any = {}) {
	        return new AttributePatch(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.status = source["status"];
	        this.group_id = source["group_id"];
	        this.profile_ids = source["profile_ids"];
	    }
	}
	export class CreateRequest {
	    kind: string;
	    name: string;
	    group_public_id: string;
	
	    static createFrom(source: any = {}) {
	        return new CreateRequest(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.kind = source["kind"];
	        this.name = source["name"];
	        this.group_public_id = source["group_public_id"];
	    }
	}
	export class Created {
	    kind: string;
	    public_id: string;
	
	    static createFrom(source: any = {}) {
	        return new Created(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.kind = source["kind"];
	        this.public_id = source["public_id"];
	    }
	}
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
	    latest_version_id?: number;
	    profile_ids: number[];
	
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
	        this.latest_version_id = source["latest_version_id"];
	        this.profile_ids = source["profile_ids"];
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
	export class EditorAsset {
	    preview_url: string;
	    title: string;
	    original_filename: string;
	
	    static createFrom(source: any = {}) {
	        return new EditorAsset(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.preview_url = source["preview_url"];
	        this.title = source["title"];
	        this.original_filename = source["original_filename"];
	    }
	}
	export class EditorLore {
	    public_id: string;
	    title: string;
	    status: string;
	
	    static createFrom(source: any = {}) {
	        return new EditorLore(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.public_id = source["public_id"];
	        this.title = source["title"];
	        this.status = source["status"];
	    }
	}
	export class Group {
	    public_id: string;
	    name: string;
	    description: string;
	    items: DocumentItem[];
	
	    static createFrom(source: any = {}) {
	        return new Group(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.public_id = source["public_id"];
	        this.name = source["name"];
	        this.description = source["description"];
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
	export class ImagePage {
	    id: string;
	    key: string;
	    asset_public_id: string;
	    image_url: string;
	    description: string;
	    sort: number;
	
	    static createFrom(source: any = {}) {
	        return new ImagePage(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.key = source["key"];
	        this.asset_public_id = source["asset_public_id"];
	        this.image_url = source["image_url"];
	        this.description = source["description"];
	        this.sort = source["sort"];
	    }
	}
	export class ListedDocument {
	    kind: string;
	    public_id: string;
	    title: string;
	    content_type: string;
	    status: string;
	    word_count: number;
	    updated_at: string;
	    group_id: string;
	    group_name: string;
	    latest_content?: string;
	
	    static createFrom(source: any = {}) {
	        return new ListedDocument(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.kind = source["kind"];
	        this.public_id = source["public_id"];
	        this.title = source["title"];
	        this.content_type = source["content_type"];
	        this.status = source["status"];
	        this.word_count = source["word_count"];
	        this.updated_at = source["updated_at"];
	        this.group_id = source["group_id"];
	        this.group_name = source["group_name"];
	        this.latest_content = source["latest_content"];
	    }
	}
	export class PenNameProfile {
	    id: number;
	    pen_name: string;
	
	    static createFrom(source: any = {}) {
	        return new PenNameProfile(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.pen_name = source["pen_name"];
	    }
	}
	export class Profile {
	    pen_name: string;
	    avatar_url: string;
	    auto_save_enabled: boolean;
	    auto_save_interval_minutes: number;
	    profiles: PenNameProfile[];
	
	    static createFrom(source: any = {}) {
	        return new Profile(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.pen_name = source["pen_name"];
	        this.avatar_url = source["avatar_url"];
	        this.auto_save_enabled = source["auto_save_enabled"];
	        this.auto_save_interval_minutes = source["auto_save_interval_minutes"];
	        this.profiles = this.convertValues(source["profiles"], PenNameProfile);
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
	export class SaveInput {
	    title: string;
	    summary: string;
	    content: string;
	    trigger: string;
	    base_version_id?: number;
	
	    static createFrom(source: any = {}) {
	        return new SaveInput(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.title = source["title"];
	        this.summary = source["summary"];
	        this.content = source["content"];
	        this.trigger = source["trigger"];
	        this.base_version_id = source["base_version_id"];
	    }
	}
	export class SaveResult {
	    latest_version_id?: number;
	    word_count: number;
	    updated_at: string;
	    version_conflict: boolean;
	
	    static createFrom(source: any = {}) {
	        return new SaveResult(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.latest_version_id = source["latest_version_id"];
	        this.word_count = source["word_count"];
	        this.updated_at = source["updated_at"];
	        this.version_conflict = source["version_conflict"];
	    }
	}
	export class UploadResult {
	    uploaded: number;
	    skipped: string[];
	
	    static createFrom(source: any = {}) {
	        return new UploadResult(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.uploaded = source["uploaded"];
	        this.skipped = source["skipped"];
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

export namespace main {
	
	export class LocalImage {
	    token: string;
	    name: string;
	    preview_url: string;
	
	    static createFrom(source: any = {}) {
	        return new LocalImage(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.token = source["token"];
	        this.name = source["name"];
	        this.preview_url = source["preview_url"];
	    }
	}
	export class LocalImagePick {
	    files: LocalImage[];
	    skipped: string[];
	
	    static createFrom(source: any = {}) {
	        return new LocalImagePick(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.files = this.convertValues(source["files"], LocalImage);
	        this.skipped = source["skipped"];
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

