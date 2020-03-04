import { Range } from "vscode-languageserver-types";
import {
	CodemarkPlus,
	FetchAssignableUsersRequestType,
	GetRangeScmInfoRequestType,
	GetRangeScmInfoResponse,
	CreateDocumentMarkerPermalinkRequestType,
	ThirdPartyProviderBoard,
	ThirdPartyProviderConfig,
	CrossPostIssueValues,
	GetReviewRequestType
} from "@codestream/protocols/agent";
import {
	CodemarkType,
	CSChannelStream,
	CSCodemark,
	CSDirectStream,
	CSStream,
	CSUser,
	StreamType,
	CSApiCapabilities,
	CSMe
} from "@codestream/protocols/api";
import cx from "classnames";
import * as paths from "path-browserify";
import React from "react";
import { connect } from "react-redux";
import Select from "react-select";
import {
	getStreamForId,
	getStreamForTeam,
	getChannelStreamsForTeam,
	getDirectMessageStreamsForTeam,
	getDMName
} from "../store/streams/reducer";
import {
	mapFilter,
	arrayToRange,
	forceAsLine,
	isRangeEmpty,
	toMapBy,
	replaceHtml,
	keyFilter,
	safe
} from "../utils";
import { HostApi } from "../webview-api";
import Button from "./Button";
import CrossPostIssueControls from "./CrossPostIssueControls";
import Tag from "./Tag";
import Icon from "./Icon";
import Menu from "./Menu";
import Tooltip from "./Tooltip";
import { sortBy as _sortBy, sortBy } from "lodash-es";
import {
	EditorSelectRangeRequestType,
	EditorSelection,
	EditorHighlightRangeRequestType
} from "@codestream/protocols/webview";
import { getCurrentSelection } from "../store/editorContext/reducer";
import Headshot from "./Headshot";
import { getTeamMembers, getTeamTagsArray, getTeamMates } from "../store/users/reducer";
import MessageInput from "./MessageInput";
import { getCurrentTeamProvider } from "../store/teams/reducer";
import { getCodemark } from "../store/codemarks/reducer";
import { CodemarksState } from "../store/codemarks/types";
import { setCurrentStream } from "../store/context/actions";
import ContainerAtEditorLine from "./SpatialView/ContainerAtEditorLine";
import ContainerAtEditorSelection from "./SpatialView/ContainerAtEditorSelection";
import { prettyPrintOne } from "code-prettify";
import { escapeHtml } from "../utils";
import { CodeStreamState } from "../store";
import { LabeledSwitch } from "../src/components/controls/LabeledSwitch";
import { CSText } from "../src/components/CSText";
import { NewCodemarkAttributes } from "../store/codemarks/actions";
import { SharingControls, SharingAttributes } from "./SharingControls";
import { SmartFormattedList } from "./SmartFormattedList";
import { Modal } from "./Modal";
import { Checkbox } from "../src/components/Checkbox";
import { isFeatureEnabled } from "../store/apiVersioning/reducer";

export interface ICrossPostIssueContext {
	setSelectedAssignees(any: any): void;
	setValues(values: any): void;
	selectedAssignees: any[];
	assigneesInputTarget?: HTMLElement;
	codeBlock?: GetRangeScmInfoResponse;
}
export const CrossPostIssueContext = React.createContext<ICrossPostIssueContext>({
	selectedAssignees: [],
	setSelectedAssignees: () => {},
	setValues: () => {}
});

interface Props extends ConnectedProps {
	streamId: string;
	collapseForm?: Function;
	onSubmit: (attributes: NewCodemarkAttributes, event?: React.SyntheticEvent) => any;
	onClickClose(skipConfirmation?: boolean): any;
	openCodemarkForm?(type: string): any;
	slackInfo?: {};
	codeBlock?: GetRangeScmInfoResponse;
	commentType?: string;
	collapsed: boolean;
	isEditing?: boolean;
	editingCodemark?: CodemarkPlus;
	placeholder?: string;
	onDidChangeSelection?(location: EditorSelection): void;
	positionAtLocation?: boolean;
	multiLocation?: boolean;
	setMultiLocation?: Function;
	noCodeLocation?: boolean;
}

interface ConnectedProps {
	teamMates: CSUser[];
	teamMembers: CSUser[];
	channelStreams: CSChannelStream[];
	directMessageStreams: CSDirectStream[];
	channel: CSStream;
	issueProvider?: ThirdPartyProviderConfig;
	providerInfo: {
		[service: string]: {};
	};
	currentUser: CSUser;
	selectedStreams: {};
	showChannels: string;
	textEditorUri?: string;
	textEditorSelection?: EditorSelection;
	teamProvider: "codestream" | "slack" | "msteams" | string;
	teamTagsArray: any;
	codemarkState: CodemarksState;
	multipleMarkersEnabled: boolean;
	shouldShare: boolean;
	currentTeamId: string;
	currentReviewId?: string;
}

interface State {
	text: string;
	formatCode: boolean;
	type: string;
	codeBlocks: GetRangeScmInfoResponse[];
	assignees: { value: any; label: string }[] | { value: any; label: string };
	assigneesRequired: boolean;
	assigneesDisabled: boolean;
	singleAssignee: boolean;
	isPermalinkPublic: boolean;
	privacyMembers: { value: string; label: string }[];
	notify: boolean;
	isLoading: boolean;
	crossPostMessage: boolean;
	crossPostIssueValues: Partial<CrossPostIssueValues>;
	assignableUsers: { value: any; label: string }[];
	channelMenuOpen: boolean;
	channelMenuTarget: any;
	labelMenuOpen: boolean;
	labelMenuTarget: any;
	locationMenuOpen: number | "header" | "closed";
	locationMenuTarget: any;
	sharingDisabled?: boolean;
	selectedChannelName?: string;
	selectedChannelId?: string;
	title?: string;
	codeBlockInvalid?: boolean;
	titleInvalid?: boolean;
	textInvalid?: boolean;
	assigneesInvalid?: boolean;
	sharingAttributesInvalid?: boolean;
	showAllChannels?: boolean;
	linkURI?: string;
	copied: boolean;
	selectedTags?: any;
	relatedCodemarkIds?: any;
	addingLocation?: boolean;
	editingLocation: number;
	liveLocation: number;
	isChangeRequest: boolean;
}

function merge(defaults: Partial<State>, codemark: CSCodemark): State {
	return Object.entries(defaults).reduce((object, entry) => {
		const [key, value] = entry;
		object[key] = codemark[key] !== undefined ? codemark[key] : value;
		return object;
	}, Object.create(null));
}

class CodemarkForm extends React.Component<Props, State> {
	static defaultProps = {
		commentType: "comment",
		isEditing: false
	};
	_titleInput: HTMLElement | null = null;
	insertTextAtCursor?: Function;
	focusOnMessageInput?: Function;
	permalinkRef = React.createRef<HTMLTextAreaElement>();
	private _assigneesContainerRef = React.createRef<HTMLDivElement>();
	private _sharingAttributes?: SharingAttributes;

	constructor(props: Props) {
		super(props);
		const defaultType = props.commentType;
		const defaultState: Partial<State> = {
			crossPostIssueValues: {},
			title: "",
			text: "",
			formatCode: false,
			type: defaultType,
			codeBlocks: props.codeBlock ? [props.codeBlock] : [],
			assignees: [],
			assigneesDisabled: false,
			assigneesRequired: false,
			singleAssignee: false,
			selectedChannelName: (props.channel as any).name,
			selectedChannelId: props.channel.id,
			assignableUsers: this.getAssignableCSUsers(),
			isPermalinkPublic: false,
			privacyMembers: [],
			selectedTags: {},
			relatedCodemarkIds: {},
			locationMenuOpen: "closed",
			editingLocation: -1,
			addingLocation: false,
			liveLocation: -1,
			isChangeRequest: false
		};

		const state = props.editingCodemark
			? merge(defaultState, props.editingCodemark)
			: ({
					isLoading: false,
					notify: false,
					...defaultState
			  } as State);

		let assignees: any;
		if (props.isEditing) {
			const externalAssignees = this.props.editingCodemark!.externalAssignees || [];
			assignees = externalAssignees
				.map(a => ({
					value: a.displayName,
					label: a.displayName
				}))
				.concat(
					mapFilter(this.props.editingCodemark!.assignees || [], a =>
						state.assignableUsers.find((au: any) => au.value === a)
					)
				);
		} else if (state.assignees === undefined) {
			assignees = undefined;
		} else if (Array.isArray(state.assignees)) {
			assignees = state.assignees.map(a => state.assignableUsers.find((au: any) => au.value === a));
		} else {
			assignees = state.assignableUsers.find((au: any) => au.value === state.assignees);
		}
		this.state = {
			...state,
			assignees
		};

		if (props.isEditing && props.editingCodemark) {
			const selectedTags = {};
			(props.editingCodemark.tags || []).forEach(tag => {
				selectedTags[tag] = true;
			});
			const relatedCodemarkIds = {};
			(props.editingCodemark.relatedCodemarkIds || []).forEach(id => {
				relatedCodemarkIds[id] = getCodemark(props.codemarkState, id);
			});
			this.state = {
				...this.state,
				selectedTags,
				relatedCodemarkIds
			};
		}
	}

	static getDerivedStateFromProps(props: Props, state: State) {
		// revisit this if the ability to change the type is added back to the form
		// TODO: this should call ComposeBox.repositionIfNecessary()
		if (props.commentType !== state.type) {
			return { type: props.commentType };
		}
		return null;
	}

	componentDidMount() {
		const { multiLocation, noCodeLocation } = this.props;
		const { codeBlocks } = this.state;

		if (codeBlocks.length === 1) {
			if (isRangeEmpty(codeBlocks[0].range)) {
				this.selectRangeInEditor(codeBlocks[0].uri, forceAsLine(codeBlocks[0].range));
			}
			this.handleScmChange();
		} else if (noCodeLocation) {
			this.focus();
		} else {
			const { textEditorSelection, textEditorUri } = this.props;
			if (textEditorSelection && textEditorUri) {
				// In case there isn't already a range selection by user, change the selection to be the line the cursor is on
				const isEmpty = isRangeEmpty(textEditorSelection);
				const range = isEmpty ? forceAsLine(textEditorSelection) : textEditorSelection;
				if (isEmpty) this.selectRangeInEditor(textEditorUri, range);
				this.getScmInfoForSelection(textEditorUri, range, () => {
					if (multiLocation) this.setState({ addingLocation: true, liveLocation: 1 });
					else this.focus();
				});
			}
		}
		// if (!multiLocation) this.focus();
	}

	rangesAreEqual(range1?: Range, range2?: Range) {
		if ((range1 && !range2) || (!range1 && range2)) return false;
		if (range1 && range2) {
			if (
				range1.start.line !== range2.start.line ||
				range1.start.character !== range2.start.character ||
				range1.end.line !== range2.end.line ||
				range1.end.character !== range2.end.character
			)
				return false;
		}
		return true;
	}

	isNonzeroSelection(range?: Range) {
		if (!range) return false;
		if (range.start.line === range.end.line && range.start.character === range.end.character)
			return false;
		return true;
	}

	componentDidUpdate(prevProps: Props) {
		const { isEditing, textEditorSelection, textEditorUri } = this.props;

		if (
			// make sure there an actual selection, not just a cursor
			this.isNonzeroSelection(textEditorSelection) &&
			// if the range didn't change, don't do anything
			!this.rangesAreEqual(prevProps.textEditorSelection, textEditorSelection) &&
			// make sure the range didn't change because we switched editors(files)
			prevProps.textEditorUri == textEditorUri &&
			!isEditing &&
			!this.state.linkURI &&
			this.state.liveLocation >= 0
		) {
			this.getScmInfoForSelection(textEditorUri!, forceAsLine(textEditorSelection!));
			this.props.onDidChangeSelection && this.props.onDidChangeSelection(textEditorSelection!);
			// this.setState({ addingLocation: false });
		}

		// if you switch files while the compose form is open, make
		// it clear that you are not commenting in the new file by
		// switching to multi-location mode, which shows the codeblock
		// and exactly what you're commenting on
		if (prevProps.textEditorUri !== textEditorUri) {
			this.addLocation();
		}

		const prevProviderHost = prevProps.issueProvider ? prevProps.issueProvider.host : undefined;
		const providerHost = this.props.issueProvider ? this.props.issueProvider.host : undefined;
		if (prevProviderHost !== providerHost) {
			this.setState({ assignees: [], crossPostIssueValues: {} });
		}
	}

	private selectRangeInEditor(uri: string, range: Range) {
		HostApi.instance.send(EditorSelectRangeRequestType, {
			uri: uri,
			selection: { ...range, cursor: range.end },
			preserveFocus: true
		});
	}

	private async getScmInfoForSelection(uri: string, range: Range, callback?: Function) {
		const scmInfo = await HostApi.instance.send(GetRangeScmInfoRequestType, {
			uri: uri,
			range: range,
			dirty: true // should this be determined here? using true to be safe
		});
		let newCodeBlocks = [...this.state.codeBlocks];
		if (this.state.liveLocation >= 0) newCodeBlocks[this.state.liveLocation] = scmInfo;
		else newCodeBlocks.push(scmInfo);

		this.setState({ codeBlocks: newCodeBlocks, addingLocation: false }, () => {
			this.handleScmChange();
			if (callback) callback();
		});
	}

	getAssignableCSUsers() {
		return mapFilter(this.props.teamMembers, user => {
			if (!user.isRegistered) return;
			return {
				value: user.id,
				label: user.username
			};
		});
	}

	async loadAssignableUsers(providerId: string, board: ThirdPartyProviderBoard) {
		if (board.assigneesDisabled) return this.setState({ assigneesDisabled: true });
		if (board.assigneesRequired) {
			this.setState(state => (state.assigneesRequired ? null : { assigneesRequired: true }));
		}
		if (board.singleAssignee) {
			this.setState(state => (state.singleAssignee ? null : { singleAssignee: true }));
		}

		try {
			const { users } = await HostApi.instance.send(FetchAssignableUsersRequestType, {
				providerId,
				boardId: board.apiIdentifier || board.id
			});

			this.setState({
				assignableUsers: users.map(u => ({
					value: u,
					label: u.displayName
				}))
			});
		} catch (error) {
			this.setState({ assignableUsers: [] });
		}
	}

	// this doesn't appear to be used anywhere -Pez
	handleSelectionChange = () => {
		const { textEditorSelection, textEditorUri } = this.props;
		if (textEditorSelection) {
			this.getScmInfoForSelection(textEditorUri!, forceAsLine(textEditorSelection));
		}
	};

	handleScmChange = () => {
		const { codeBlocks } = this.state;

		this.setState({ codeBlockInvalid: false });

		if (!codeBlocks.length) return;

		const codeBlock =
			this.state.liveLocation >= 0 ? codeBlocks[this.state.liveLocation] : codeBlocks[0];

		if (!codeBlock) return;

		let mentions: Record<"id" | "username", string>[] = [];
		if (codeBlock.scm && codeBlock.scm.authors) {
			mentions = codeBlock.scm.authors.filter(author => author.id !== this.props.currentUser.id);
		}

		if (mentions.length > 0) {
			// TODO handle users with no username
			const usernames: string[] = mentions.map(u => `@${u.username}`);
			// if there's text in the compose area, return without
			// adding the suggestion
			if (this.state.text.length > 0) return;
			// the reason for this unicode space is that chrome will
			// not render a space at the end of a contenteditable div
			// unless it is a &nbsp;, which is difficult to insert
			// so we insert this unicode character instead
			this.focusOnMessageInput &&
				this.focusOnMessageInput(() => {
					this.insertTextAtCursor && this.insertTextAtCursor(usernames.join(", ") + ":\u00A0");
				});
		}
	};

	// TODO: remove this
	tabIndex = () => {
		return 0;
	};

	// TODO: work on this from initial mount
	focus = (forceMainInput = false) => {
		// if (forceMainInput && this._contentEditable) return this._contentEditable.htmlEl.focus();

		switch (this.state.type) {
			case "question":
			case "issue":
			case "bookmark":
				this._titleInput && this._titleInput.focus();
				break;
			case "snippet":
			case "comment":
			default:
				this.focusOnMessageInput && this.focusOnMessageInput();
		}
	};

	// onSelectCodemarkType = (type?: string) => {
	// 	this.setState({ menuOpen: false });
	// 	if (type) this.setCommentType(type);
	// }

	setCommentType = (type: string) => {
		if (this.props.editingCodemark) return;
		this.setState({
			type,
			codeBlockInvalid: false,
			titleInvalid: false,
			textInvalid: false
		});
		// setTimeout(() => {
		// 	// this.focus();
		// }, 20);
	};

	togglePermalinkPrivacy = (isPermalinkPublic: boolean) => {
		this.setState({
			isPermalinkPublic
		});
	};

	// toggleCodemarkPrivacy = (isCodemarkPublic: boolean) => {
	// 	this.setState(state => {
	// 		const sharingDisabled = !isCodemarkPublic;
	// 		const shouldShare = sharingDisabled ? false : state.shouldShare;
	// 		return { sharingDisabled, shouldShare };
	// 	});
	// };

	toggleNotify = () => {
		this.setState({ notify: !this.state.notify });
	};

	toggleCrossPostMessage = () => {
		this.setState(state => ({ crossPostMessage: !state.crossPostMessage }));
	};

	handleClickSubmit = async (event?: React.SyntheticEvent) => {
		event && event.preventDefault();
		if (this.state.isLoading) return;
		if (this.isFormInvalid()) return;

		const {
			codeBlocks,
			isPermalinkPublic,
			type,
			title,
			text,
			selectedChannelId,
			selectedTags,
			relatedCodemarkIds
		} = this.state;

		// FIXME
		const codeBlock = codeBlocks[0];

		if (type === "link") {
			let request;
			const privacy = isPermalinkPublic ? "public" : "private";
			if (codeBlock) {
				request = {
					uri: codeBlock.uri,
					range: codeBlock.range,
					privacy: privacy
				};
			} else {
				request = {
					uri: this.props.textEditorUri,
					range: this.props.textEditorSelection,
					privacy: privacy
				};
			}

			this.setState({ isLoading: true });

			const response = await HostApi.instance.send(
				CreateDocumentMarkerPermalinkRequestType,
				request
			);
			this.setState({ linkURI: response.linkUrl, isLoading: false });

			return;
		}

		const crossPostIssueValues = { ...this.state.crossPostIssueValues };
		const crossPostIssueEnabled =
			type === CodemarkType.Issue && this.props.issueProvider != undefined;

		let csAssignees: string[] = [];
		if (crossPostIssueEnabled) {
			const assignees = Array.isArray(this.state.assignees)
				? this.state.assignees
				: [this.state.assignees];

			csAssignees = mapFilter(assignees, a => {
				const user = a.value;
				const codestreamUser = this.props.teamMembers.find(
					t => Boolean(user.email) && t.email === user.email
				);
				if (codestreamUser) return codestreamUser.id;
				return undefined;
			});
			crossPostIssueValues.assignees = assignees.map(a => a.value);
			crossPostIssueValues.issueProvider = this.props.issueProvider;
		} else
			csAssignees = this.props.isEditing
				? this.props.editingCodemark!.assignees
				: (this.state.assignees as any[]).map(a => a.value);

		this.setState({ isLoading: true });

		let parentPostId: string | undefined = undefined;
		// all codemarks created while in a review are attached to that review
		if (this.props.currentReviewId) {
			try {
				const response = await HostApi.instance.send(GetReviewRequestType, {
					reviewId: this.props.currentReviewId
				});
				parentPostId = response.review.postId;
			} catch (error) {
				// FIXME what do we do if we don't find the review?
			}
		}

		try {
			const baseAttributes = {
				codeBlocks,
				text: replaceHtml(text)!,
				type: type as CodemarkType,
				assignees: csAssignees,
				title,
				crossPostIssueValues: crossPostIssueEnabled
					? (crossPostIssueValues as CrossPostIssueValues)
					: undefined,
				tags: keyFilter(selectedTags),
				relatedCodemarkIds: keyFilter(relatedCodemarkIds),
				parentPostId,
				isChangeRequest: this.state.isChangeRequest
			};
			if (this.props.teamProvider === "codestream") {
				await this.props.onSubmit({
					...baseAttributes,
					sharingAttributes: this.props.shouldShare ? this._sharingAttributes : undefined,
					accessMemberIds: this.state.privacyMembers.map(m => m.value)
				});
			} else {
				await this.props.onSubmit({ ...baseAttributes, streamId: selectedChannelId! }, event);
				(this.props as any).dispatch(setCurrentStream(selectedChannelId));
			}
		} catch (error) {
		} finally {
			this.setState({ isLoading: false });
		}
	};

	isFormInvalid = () => {
		const { codeBlocks } = this.state;
		const { text, title, assignees, crossPostIssueValues, type } = this.state;

		if (type === CodemarkType.Link) return false;
		// FIXME
		const codeBlock = codeBlocks[0];

		const validationState: Partial<State> = {
			codeBlockInvalid: false,
			titleInvalid: false,
			textInvalid: false,
			assigneesInvalid: false,
			sharingAttributesInvalid: false
		};

		let invalid = false;
		if (type === "trap" || type === "bookmark") {
			if (!codeBlock) {
				validationState.codeBlockInvalid = true;
				invalid = true;
			}
		}
		if (type === "question" || type === "issue") {
			if (!title || title.length === 0) {
				validationState.titleInvalid = true;
				invalid = true;
			}
			if (
				crossPostIssueValues.assigneesRequired &&
				(!assignees || (Array.isArray(assignees) && assignees.length === 0))
			) {
				invalid = validationState.assigneesInvalid = true;
			}
		}
		if (type === "comment" || type === "trap") {
			if (text.length === 0) {
				validationState.textInvalid = true;
				invalid = true;
			}
		}

		if (
			!this.props.isEditing &&
			this.props.shouldShare &&
			!this._sharingAttributes &&
			!this.props.currentReviewId
		) {
			invalid = true;
			validationState.sharingAttributesInvalid = true;
		}

		this.setState(validationState as State);
		return invalid;
	};

	showAlertHelp = event => {
		event.stopPropagation();
	};

	renderTitleHelp = () => {
		const { titleInvalid } = this.state;

		if (titleInvalid) {
			return <small className="error-message">Required</small>;
		} else return null;
	};

	renderTextHelp = () => {
		const { textInvalid } = this.state;

		if (textInvalid) {
			return <small className="error-message">Required</small>;
		} else return null;
	};

	switchChannel = (event: React.SyntheticEvent) => {
		if (this.props.isEditing) return;

		event.stopPropagation();
		if (!this.state.channelMenuOpen) {
			const target = event.target;
			this.setState(state => ({
				channelMenuOpen: !state.channelMenuOpen,
				channelMenuTarget: target,
				crossPostMessage: true
			}));
		}
	};

	selectChannel = (stream: CSStream | "show-all") => {
		if (stream === "show-all") {
			this.setState({ showAllChannels: true });
			return;
		} else if (stream && stream.id) {
			const channelName = (stream.type === StreamType.Direct ? "@" : "#") + (stream as any).name;
			this.setState({ selectedChannelName: channelName, selectedChannelId: stream.id });
		}
		this.setState({ channelMenuOpen: false });
		this.focus();
	};

	switchLocation = (event: React.SyntheticEvent, index: number | "header") => {
		if (this.props.isEditing) return;

		const target = event.target;
		this.setState({
			liveLocation: -1,
			locationMenuOpen: index,
			locationMenuTarget: target
		});
	};

	editLocation = (index: number, event?: React.SyntheticEvent) => {
		if (event) event.stopPropagation();
		this.setState({ locationMenuOpen: "closed", liveLocation: index, addingLocation: false });
	};

	deleteLocation = (index: number, event?: React.SyntheticEvent) => {
		if (event) event.stopPropagation();
		let newCodeBlocks = [...this.state.codeBlocks];
		newCodeBlocks.splice(index, 1);
		this.setState({
			locationMenuOpen: "closed",
			codeBlocks: newCodeBlocks
		});
		this.addLocation();
		this.focus();
	};

	addLocation = () => {
		this.setState(state => ({
			locationMenuOpen: "closed",
			addingLocation: true,
			liveLocation: state.codeBlocks.length
		}));
		if (this.props.setMultiLocation && !this.props.multiLocation) this.props.setMultiLocation(true);
	};

	cementLocation = (event: React.SyntheticEvent) => {
		const { codeBlocks, liveLocation } = this.state;
		event.stopPropagation();

		try {
			const { file: newFile, repoPath: newRepoPath } = codeBlocks[liveLocation].scm!;
			const { file, repoPath } = codeBlocks[0].scm!;
			let location = "Same File";
			if (repoPath !== newRepoPath) location = "Different Repo";
			else if (file !== newFile) location = "Different File";
		} catch (e) {}

		this.addLocation();
		this.focus();
	};

	jumpToLocation = (index: number, event?: React.SyntheticEvent) => {
		if (event) event.stopPropagation();
		this.toggleCodeHighlightInTextEditor(true, index);
	};

	selectLocation = (action: "add" | "edit" | "delete") => {
		this.setState({ locationMenuOpen: "closed" });
	};

	switchLabel = (event: React.SyntheticEvent) => {
		event.stopPropagation();
		const target = event.target;
		this.setState(state => ({
			labelMenuOpen: !state.labelMenuOpen,
			labelMenuTarget: target
		}));
	};

	// selectLabel = (color: string) => {
	// 	this.setState({ color: color, labelMenuOpen: false });
	// };

	// handleClickConnectSlack = async event => {
	// 	event.preventDefault();
	// 	this.setState({ isLoading: true });
	// 	await HostApi.instance.send(GoToSlackSignin); // TODO: use the provider api
	// 	this.setState({ isLoading: false });
	// }

	renderTags = () => {
		const { selectedTags } = this.state;
		const keys = Object.keys(selectedTags);
		if (keys.length === 0) return null;

		return (
			<div className="related">
				<div className="related-label">Tags</div>
				<div style={{ marginBottom: "-5px" }}>
					{this.props.teamTagsArray.map(tag => {
						return selectedTags[tag.id] ? <Tag tag={tag} /> : null;
					})}
					<div style={{ clear: "both" }} />
				</div>
			</div>
		);
	};

	/*
	Sharing model v1 will only be public codemarks
	 see https://trello.com/c/M3KV7p4g/2728-make-all-codemarks-in-sharing-model-team-accessible
	*/
	/*
	renderPrivacyControls = () => {
		if (
			!this.props.isEditing &&
			this.props.teamProvider === "codestream" &&
			this.props.commentType !== CodemarkType.Link
		) {
			return (
				<>
					<Spacer />
					<div style={{ display: "flex", alignItems: "center", minHeight: "40px" }}>
						<div style={{ display: "inline-flex", width: "100%", alignItems: "center" }}>
							<span style={{ minWidth: "max-content" }}>
								<CSText muted as="div">
									Who can see this?
								</CSText>
							</span>
							<span style={{ marginLeft: "10px", width: "100%" }}>
								<Select
									id="input-assignees"
									classNamePrefix="react-select"
									isMulti
									defaultValue={this.state.privacyMembers}
									options={this.props.teamMates.map(u => ({
										label: u.username,
										value: u.id
									}))}
									closeMenuOnSelect={false}
									isClearable
									placeholder="Entire Team"
									onChange={(value: any, meta: any) => {
										this.setState({
											privacyMembers: value,
											sharingDisabled: meta.action === "select-option"
										});
									}}
								/>
							</span>
						</div>
					</div>
				</>
			);
		}
		return null;
	};
	 */

	renderRequireChange = () => {
		return (
			<div style={{ float: "left", paddingTop: "10px" }}>
				<Checkbox
					name="change-request"
					checked={this.state.isChangeRequest}
					onChange={value => this.setState({ isChangeRequest: value })}
				>
					Change Request (require for approval)
				</Checkbox>
			</div>
		);
	};

	renderSharingControls = () => {
		if (this.props.isEditing) return null;
		if (this.props.currentReviewId) return null;

		const { codeBlocks } = this.state;
		// we only look at the first code range here because we're using it to default
		// the channel based on the selected repo -- so we look at the first one
		const repoId = codeBlocks[0] && codeBlocks[0].scm && codeBlocks[0].scm.repoId;

		return (
			<div className="checkbox-row" style={{ float: "left" }}>
				{this.state.sharingDisabled ? (
					<CSText muted>
						<SmartFormattedList value={this.state.privacyMembers.map(m => m.label)} /> will be
						notified via email
					</CSText>
				) : (
					<SharingControls
						showToggle
						onChangeValues={values => {
							this._sharingAttributes = values;
						}}
						repoId={repoId}
					/>
				)}
			</div>
		);
	};

	renderRelatedCodemarks = () => {
		const { relatedCodemarkIds } = this.state;
		const keys = keyFilter(relatedCodemarkIds);
		if (keys.length === 0) return null;

		return (
			<div className="related" key="related-codemarks">
				<div className="related-label">Related</div>
				<div className="related-codemarks" key="related-codemarks" style={{ margin: "0 0 0 0" }}>
					{keys.map(key => {
						const codemark = relatedCodemarkIds[key];
						if (!codemark) return null;

						const title = codemark.title || codemark.text;
						const icon = (
							<Icon
								name={codemark.type || "comment"}
								className={`${codemark.color}-color type-icon`}
							/>
						);
						const file = codemark.markers && codemark.markers[0] && codemark.markers[0].file;

						return (
							<div key={key} className="related-codemark">
								{icon}&nbsp;{title}&nbsp;&nbsp;<span className="codemark-file">{file}</span>
								<span style={{ marginLeft: 5 }}>
									<Icon name="x" onClick={() => this.handleToggleCodemark(codemark)} />
								</span>
							</div>
						);
					})}
					<div style={{ clear: "both" }} />
				</div>
			</div>
		);
	};

	handleKeyPress = (event: React.KeyboardEvent) => {
		if (event.key == "Enter") return this.switchChannel(event);
	};

	renderCrossPostMessage = commentType => {
		const { selectedStreams, showChannels } = this.props;
		const { showAllChannels, selectedChannelId } = this.state;
		// if (this.props.slackInfo || this.props.providerInfo.slack) {
		const items: {
			label?: string;
			searchLabel?: string;
			action?: CSStream | "show-all" | "search";
			key?: string;
			type?: string;
			placeholder?: string;
		}[] = [];

		// let labelMenuItems: any = [{ label: "None", action: "" }, { label: "-" }];

		// labelMenuItems = labelMenuItems.concat(
		// 	COLOR_OPTIONS.map(color => {
		// 		return {
		// 			label: (
		// 				<span className={`${color}-color`}>
		// 					<Icon name={commentType} /> {color}
		// 				</span>
		// 			),
		// 			action: color
		// 		};
		// 	})
		// );
		// labelMenuItems.push({ label: "-" });
		// labelMenuItems.push({ label: "Edit Labels", action: "edit" });

		let firstChannel;
		let selectedChannelName = "";
		const filterSelected = showChannels === "selected" && !showAllChannels;
		this.props.channelStreams.forEach(channel => {
			if (channel.isArchived || (filterSelected && !selectedStreams[channel.id])) return;

			if (channel.id === selectedChannelId) {
				selectedChannelName = "#" + channel.name!;
			}
			if (!firstChannel) {
				firstChannel = channel;
			}

			items.push({
				label: `#${channel.name}`,
				action: channel,
				key: channel.id,
				searchLabel: `#${channel.name}`
			});
		});

		if (this.props.directMessageStreams.length > 0) {
			items.push({ label: "-" });

			let firstDM = items.length;

			const currentUserId = this.props.currentUser.id;
			_sortBy(this.props.directMessageStreams, (stream: CSDirectStream) =>
				(stream.name || "").toLowerCase()
			).forEach((channel: CSDirectStream) => {
				if (
					channel.isArchived ||
					(channel.isClosed && items.length - firstDM > 10) ||
					(filterSelected && !selectedStreams[channel.id])
				) {
					return;
				}

				if (channel.id === selectedChannelId) {
					selectedChannelName = "@" + channel.name!;
				}
				if (!firstChannel) {
					firstChannel = channel;
				}

				const item = {
					label: channel.name!,
					action: channel,
					key: channel.id,
					searchLabel: channel.name!
				};
				// Ensure Slackbot is first (if there), then your own DM
				if (channel.memberIds.length === 2 && channel.memberIds.includes("USLACKBOT")) {
					items.splice(firstDM, 0, item);
					firstDM++;
				} else if (channel.memberIds.length === 1 && channel.memberIds[0] === currentUserId) {
					items.splice(firstDM, 0, item);
				} else {
					items.push(item);
				}
			});
		}

		// if we don't have a name set here, that means you've filtered to a set
		// of streams that doesn't include your currently selected stream. so
		// we need to select it
		if (selectedChannelName.length === 0 && firstChannel) this.selectChannel(firstChannel);

		// if there is only 1 item, say #general,
		// in that case, the user hasn't added channels yet, or
		// invited users, so it's not helpful/useful to give them an option
		// they can't use.
		if (items.length === 1 && showChannels !== "selected") return null;

		if (filterSelected) {
			items.push({ label: "-" });
			items.push({ label: "Show All Channels & DMs", action: "show-all" });
		}

		if (items.length >= 1) {
			items.unshift({ label: "-" });
			items.unshift({ type: "search", placeholder: "Search...", action: "search" });
		}

		return (
			<div key="crosspost" className="checkbox-row" style={{ float: "left" }}>
				{/*<input type="checkbox" checked={this.state.crossPostMessage} /> */} Post to{" "}
				<span
					className="channel-label"
					onClick={this.switchChannel}
					onKeyPress={this.handleKeyPress}
					tabIndex={this.tabIndex()}
				>
					{selectedChannelName}
					<Icon name="chevron-down" />
					{this.state.channelMenuOpen && (
						<Menu
							title="Post to..."
							align="center"
							target={this.state.channelMenuTarget}
							items={items}
							action={this.selectChannel}
						/>
					)}
				</span>
			</div>
		);
		// }
		// else {
		// 	return (
		// 		<div className="checkbox-row connect-messaging" onClick={this.toggleCrossPostMessage}>
		// 			Post to
		// 			<span className="service" onClick={this.handleClickConnectSlack}>
		// 				<Icon className="slack" name="slack" />
		// 				Slack
		// 			</span>
		// 			{this.state.isLoading && (
		// 				<span>
		// 					<Icon className="spin" name="sync" /> Syncing channels...
		// 				</span>
		// 			)}
		// 		</div>
		// 	);
		// }
	};

	handleChange = (text, formatCode) => {
		// track newPostText as the user types
		this.setState({ text, formatCode });
	};

	handleChangeTag = newTag => {
		const newTagCopy = { ...newTag };
		if (newTag.id) {
			// TAGS.forEach((tag, index) => {
			// if (tag.id === newTag.id) TAGS[index] = newTagCopy;
			// });
		} else {
			// newTagCopy.id = TAGS.length + 1;
			// TAGS = TAGS.concat(newTagCopy);
		}
	};

	handleToggleTag = tagId => {
		if (!tagId) return;
		let selectedTags = this.state.selectedTags;
		selectedTags[tagId] = !selectedTags[tagId];
		this.setState({ selectedTags });
	};

	handleToggleCodemark = codemark => {
		if (!codemark || !codemark.id) return;
		let relatedCodemarkIds = this.state.relatedCodemarkIds;
		if (relatedCodemarkIds[codemark.id]) delete relatedCodemarkIds[codemark.id];
		else {
			relatedCodemarkIds[codemark.id] = codemark;
			HostApi.instance.track("Related Codemark Added", {
				"Codemark ID": this.props.editingCodemark ? this.props.editingCodemark.id : undefined,
				"Sibling Status": this.props.isEditing ? "Existing Codemark" : "New Codemark"
			});
		}
		this.setState({ relatedCodemarkIds });
	};

	handleChangeRelated = codemarkIds => {
		this.setState({ relatedCodemarkIds: codemarkIds });
	};

	renderCodeblock(marker) {
		if (marker === undefined) return;

		const path = marker.file || "";
		let extension = paths.extname(path).toLowerCase();
		if (extension.startsWith(".")) {
			extension = extension.substring(1);
		}

		let startLine = 1;
		// `range` is not a property of CSMarker
		/* if (marker.range) {
			startLine = marker.range.start.line;
		} else if (marker.location) {
			startLine = marker.location[0];
		} else */ if (
			marker.locationWhenCreated
		) {
			startLine = marker.locationWhenCreated[0];
		}

		const codeHTML = prettyPrintOne(escapeHtml(marker.code), extension, startLine);
		return [
			<div className="related" style={{ padding: "0 10px", marginBottom: 0, position: "relative" }}>
				<div className="file-info">
					<span className="monospace" style={{ paddingRight: "20px" }}>
						<Icon name="file"></Icon> {marker.file}
					</span>{" "}
					{marker.branchWhenCreated && (
						<>
							<span className="monospace" style={{ paddingRight: "20px" }}>
								<Icon name="git-branch"></Icon> {marker.branchWhenCreated}
							</span>{" "}
						</>
					)}
					<span className="monospace">
						<Icon name="git-commit"></Icon> {marker.commitHashWhenCreated.substring(0, 7)}
					</span>
				</div>
				<pre
					className="code prettyprint"
					data-scrollable="true"
					dangerouslySetInnerHTML={{ __html: codeHTML }}
				/>
			</div>
		];
	}

	getTitleLabel() {
		const { editingCodemark } = this.props;
		const commentType = editingCodemark ? editingCodemark.type : this.state.type;
		return commentType === "issue"
			? "issue in "
			: commentType === "question"
			? "question in "
			: commentType === "bookmark"
			? "bookmark in "
			: commentType === "link"
			? "permalink for "
			: commentType === "comment"
			? "comment in "
			: "";
	}

	getCodeBlockHint() {
		const { editingCodemark } = this.props;
		const { codeBlocks, liveLocation } = this.state;

		if (!codeBlocks.length) return this.renderAddLocation();

		if (this.props.multiLocation) {
			const numLocations = codeBlocks.length; // + (this.state.addingLocation ? 1 : 0);
			return (
				<>
					<span className="subhead">{this.getTitleLabel()}&nbsp;</span>
					<span className="channel-label" style={{ display: "inline-block" }}>
						<div className="location">
							{numLocations} location{numLocations > 1 ? "s" : ""}
						</div>
					</span>
					{this.state.addingLocation || liveLocation >= 0 || this.renderAddLocation()}
				</>
			);
		} else {
			const codeBlock = codeBlocks[0];
			if (!codeBlock) return null;
			if (liveLocation == 0 && !codeBlock.range)
				return <span className="add-range">Select a range to add a code location</span>;

			if (!codeBlock.range) return null;

			const scm = codeBlock.scm;
			let file = scm && scm.file ? paths.basename(scm.file) : "";

			let range: any = codeBlock.range;
			if (editingCodemark) {
				if (editingCodemark.markers) {
					const marker = editingCodemark.markers[0];
					if (marker.locationWhenCreated) {
						// TODO: location is likely invalid
						range = arrayToRange(marker.locationWhenCreated as any);
					} else {
						range = undefined;
					}
					file = marker.file || "";
				}
			}

			let lines: string;
			if (range === undefined) lines = "";
			else if (range.start.line === range.end.line) {
				lines = `(Line ${range.start.line + 1})`;
			} else {
				lines = `(Lines ${range.start.line + 1}-${range.end.line + 1})`;
			}
			return (
				<>
					{this.renderAddLocation()}
					<span className="subhead">{this.getTitleLabel()}&nbsp;</span>
					<span className="channel-label" style={{ display: "inline-block" }}>
						<div
							className={cx("location", { live: liveLocation == 0 })}
							onClick={e => this.switchLocation(e, "header")}
						>
							{file} {lines}
						</div>
					</span>
				</>
			);
		}
	}

	renderAddLocation() {
		if (
			!this.props.multipleMarkersEnabled ||
			this.props.isEditing ||
			this.props.commentType === "link"
		)
			return null;

		return (
			<div className="add-location">
				<Tooltip
					placement="topRight"
					title="Codemarks can refer to one or more blocks of code, even across files."
					delay={1}
				>
					<span onClick={e => this.addLocation()}>
						<Icon name="plus" />
						add range
					</span>
				</Tooltip>
			</div>
		);
	}

	async toggleCodeHighlightInTextEditor(highlight: boolean, index: number) {
		const codeBlock = this.state.codeBlocks[index];
		if (!codeBlock || !codeBlock.range || !codeBlock.uri) return;

		HostApi.instance.send(EditorHighlightRangeRequestType, {
			uri: codeBlock.uri,
			range: codeBlock.range,
			highlight: highlight
		});
	}

	renderMessageInput = () => {
		const { codeBlocks, type, text } = this.state;
		let placeholder = this.props.placeholder;

		if (codeBlocks.length) {
			// const range = codeBlock ? arrayToRange(codeBlock.location) : null;
			// let rangeText = "";
			// if (range && codeBlock && codeBlock.file) {
			// 	rangeText += "Add comment for " + codeBlock.file;
			// 	const endLine = range.end.col == 0 ? range.end.row : range.end.row + 1;
			// 	if (range.start.row + 1 === endLine) {
			// 		rangeText += " line " + (range.start.row + 1);
			// 	} else {
			// 		rangeText += " lines " + (range.start.row + 1) + "-" + endLine;
			// 	}
			// 	// placeholder = rangeText;
			// }
			if (type === "question") placeholder = "Answer (optional)";
			else if (type === "issue") placeholder = "Description (optional)";
			else placeholder = "";
		}

		const __onDidRender = ({ insertTextAtCursor, focus }) => {
			this.insertTextAtCursor = insertTextAtCursor;
			this.focusOnMessageInput = focus;
		};

		return (
			<MessageInput
				teamProvider={this.props.teamProvider}
				isDirectMessage={this.props.channel.type === StreamType.Direct}
				text={text.replace(/\n/g, "<br/>")}
				placeholder={placeholder}
				multiCompose
				onChange={this.handleChange}
				withTags
				toggleTag={this.handleToggleTag}
				toggleCodemark={this.handleToggleCodemark}
				shouldShowRelatableCodemark={codemark =>
					this.props.editingCodemark ? codemark.id !== this.props.editingCodemark.id : true
				}
				onSubmit={this.handleClickSubmit}
				selectedTags={this.state.selectedTags}
				relatedCodemarkIds={this.state.relatedCodemarkIds}
				__onDidRender={__onDidRender}
			/>
		);
	};

	copyPermalink = (event: React.SyntheticEvent) => {
		event.preventDefault();
		if (this.permalinkRef.current) {
			this.permalinkRef.current.select();
			document.execCommand("copy");
			this.setState({ copied: true });
		}
	};

	renderCodeBlocks = () => {
		const { codeBlocks, liveLocation } = this.state;
		const { editingCodemark, multiLocation } = this.props;

		const numCodeBlocks = codeBlocks.length;

		if (multiLocation) {
			return (
				<>
					{codeBlocks.map((codeBlock, index) => {
						if (!codeBlock) return null;
						if (liveLocation == index && !codeBlock.range)
							return <span className="add-range">Select a range to add a code location</span>;

						if (!codeBlock.range) return null;

						const scm = codeBlock.scm;

						let file = scm && scm.file ? paths.basename(scm.file) : "";

						let range: any = codeBlock.range;
						if (editingCodemark) {
							if (editingCodemark.markers) {
								const marker = editingCodemark.markers[0];
								if (marker.locationWhenCreated) {
									// TODO: location is likely invalid
									range = arrayToRange(marker.locationWhenCreated as any);
								} else {
									range = undefined;
								}
								file = marker.file || "";
							}
						}
						let extension = paths.extname(file).toLowerCase();
						if (extension.startsWith(".")) extension = extension.substring(1);

						const codeHTML = prettyPrintOne(
							escapeHtml(codeBlock.contents),
							extension,
							range.start.line + 1
						);
						return (
							<div
								className={cx("related", { live: liveLocation == index })}
								style={{ padding: "0", marginBottom: 0, position: "relative" }}
							>
								<div className="file-info">
									{file && (
										<>
											<span className="monospace" style={{ paddingRight: "20px" }}>
												<Icon name="file"></Icon> {file}
											</span>{" "}
										</>
									)}
									{scm && scm.branch && (
										<>
											<span className="monospace" style={{ paddingRight: "20px" }}>
												<Icon name="git-branch"></Icon> {scm.branch}
											</span>{" "}
										</>
									)}
									{scm && scm.revision && (
										<span className="monospace">
											<Icon name="git-commit"></Icon> {scm.revision.substring(0, 7)}
										</span>
									)}
								</div>
								<pre
									className="code prettyprint"
									data-scrollable="true"
									dangerouslySetInnerHTML={{ __html: codeHTML }}
								/>
								{liveLocation == index && (
									<div className="code-buttons live">
										<div className="codemark-actions-button ok" onClick={this.cementLocation}>
											OK
										</div>
										<div
											className="codemark-actions-button"
											onClick={e => this.deleteLocation(index, e)}
										>
											Cancel
										</div>
									</div>
								)}
								{liveLocation != index && (
									<div className="code-buttons">
										<Icon
											title={"Jump to this range in " + file}
											placement="bottom"
											name="link-external"
											className="clickable"
											onClick={e => this.jumpToLocation(index, e)}
										/>
										<Icon
											title="Select new range"
											placement="bottom"
											name="select"
											className="clickable"
											onClick={e => this.editLocation(index, e)}
										/>
										{numCodeBlocks > 1 && (
											<Icon
												title="Delete Range"
												placement="bottom"
												name="x"
												className="clickable"
												onClick={e => this.deleteLocation(index, e)}
											/>
										)}
									</div>
								)}
								<div style={{ clear: "both" }}></div>
							</div>
						);
					})}
					{this.state.addingLocation && (
						<div className="add-range" style={{ clear: "both", position: "relative" }}>
							Select code in your editor to add a range
							<div className="code-buttons live">
								<div
									className="codemark-actions-button"
									style={{ margin: "2px 0" }}
									onClick={e => {
										this.setState({ addingLocation: false, liveLocation: -1 });
										this.focus();
									}}
								>
									Cancel
								</div>
							</div>
						</div>
					)}
				</>
			);
		} else if (liveLocation == 0) {
			return (
				<div className="add-range" style={{ clear: "both", position: "relative" }}>
					Select a new range
					<div className="code-buttons live">
						<div
							className="codemark-actions-button"
							style={{ margin: "2px 0" }}
							onClick={e => this.setState({ liveLocation: -1 })}
						>
							OK
						</div>
					</div>
				</div>
			);
		} else return null;
	};

	private _getCrossPostIssueContext(): ICrossPostIssueContext {
		return {
			setSelectedAssignees: assignees => this.setState({ assignees }),
			selectedAssignees: this.state.assignees as any,
			assigneesInputTarget:
				this._assigneesContainerRef.current ||
				(document.querySelector("#members-controls")! as any) ||
				document.createElement("span"),
			setValues: values => {
				this.setState(state => ({
					crossPostIssueValues: { ...state.crossPostIssueValues, ...values }
				}));
			},
			codeBlock: this.state.codeBlocks[0]
		};
	}

	cancelCompose = () => {
		// skip confirmation
		if (this.props.onClickClose) this.props.onClickClose(true);
	};

	render() {
		const { codeBlocks } = this.state;
		const { editingCodemark, currentReviewId } = this.props;

		const commentType = editingCodemark ? editingCodemark.type : this.state.type || "comment";

		// if you are conducting a review, and somehow are able to try to
		// create an issue or a permalink, stop the user from doing that
		if (commentType !== "comment" && currentReviewId) {
			return (
				<Modal onClose={this.cancelCompose} verticallyCenter>
					<div style={{ width: "20em", fontSize: "larger", margin: "0 auto" }}>
						Sorry, you can't add an issue while doing a review. Mark your a comment as a "change
						request" instead.
						<div className="button-group one-button">
							<Button className="control-button" onClick={this.cancelCompose}>
								OK
							</Button>
						</div>
					</div>
				</Modal>
			);
		}

		if (this.props.multiLocation) {
			return (
				<div className="full-height-codemark-form">
					<span className="plane-container">
						<div className="codemark-form-container">{this.renderCodemarkForm()}</div>
					</span>
				</div>
			);
		} else if (this.props.positionAtLocation) {
			if (codeBlocks[0]) {
				const lineNumber = codeBlocks[0].range.start.line;
				return (
					<ContainerAtEditorLine repositionToFit lineNumber={lineNumber} className="cs-has-form">
						<div className="codemark-form-container">{this.renderCodemarkForm()}</div>
					</ContainerAtEditorLine>
				);
			} else {
				return (
					<ContainerAtEditorSelection className="cs-has-form">
						<div className="codemark-form-container">{this.renderCodemarkForm()}</div>
					</ContainerAtEditorSelection>
				);
			}
		} else {
			return this.renderCodemarkForm();
		}
	}

	renderCodemarkForm() {
		const { editingCodemark, currentUser } = this.props;
		const commentType = editingCodemark ? editingCodemark.type : this.state.type || "comment";

		const titlePlaceholder =
			commentType === "issue"
				? "Title (required)"
				: commentType === "question"
				? "Question (required)"
				: commentType === "bookmark"
				? "Bookmark Name (optional)"
				: "Title (optional)";

		const modifier = navigator.appVersion.includes("Macintosh") ? "⌘" : "Alt";

		const submitTip =
			commentType === "link" ? (
				this.state.copied ? (
					"Copied!"
				) : this.state.linkURI ? (
					"Copy Link"
				) : (
					"Create Link"
				)
			) : commentType === "issue" ? (
				"Create Issue"
			) : commentType === "bookmark" ? (
				"Create Bookmark"
			) : (
				<span>
					Submit Comment<span className="keybinding extra-pad">{modifier} ENTER</span>
				</span>
			);

		const cancelTip = (
			<span>
				Discard Comment<span className="keybinding extra-pad">ESC</span>
			</span>
		);

		const locationItems: any[] = [];
		if (this.props.multipleMarkersEnabled && this.props.commentType !== "link")
			locationItems.push({ label: "Add Range", action: () => this.addLocation() });
		// { label: "Change Location", action: () => this.editLocation(0) }

		if (!this.props.multiLocation)
			locationItems.push({ label: "Select New Range", action: () => this.editLocation(0) });
		if (this.state.codeBlocks.length == 1)
			locationItems.push({ label: "Remove Location", action: () => this.deleteLocation(0) });

		return [
			<form
				id="code-comment-form"
				className={cx("codemark-form", "standard-form", { "google-style": true })}
				key="two"
			>
				<fieldset className="form-body">
					<div id="controls" className="control-group" key="controls1">
						<div key="headshot" className="headline">
							<Headshot person={currentUser} />
							<b>{currentUser.username}</b>
							{this.getCodeBlockHint()}
							{this.state.locationMenuOpen == "header" && (
								<Menu
									align="center"
									target={this.state.locationMenuTarget}
									items={locationItems}
									action={this.selectLocation}
								/>
							)}
						</div>
						{/* false && commentType === "bookmark" && (
							<div className="hint frame control-group" style={{ marginBottom: "10px" }}>
								{bookmarkTip}
							</div>
						) */}
						{commentType === "issue" && !this.props.isEditing && (
							<CrossPostIssueContext.Provider value={this._getCrossPostIssueContext()}>
								<CrossPostIssueControls />
							</CrossPostIssueContext.Provider>
						)}
						{(commentType === "issue" ||
							commentType === "question" ||
							commentType === "bookmark" ||
							commentType === "snippet") && (
							<div key="title" className="control-group">
								{this.renderTitleHelp()}
								<input
									key="title-text"
									type="text"
									name="title"
									className="input-text control"
									tabIndex={this.tabIndex()}
									value={this.state.title}
									onChange={e => this.setState({ title: e.target.value })}
									placeholder={titlePlaceholder}
									ref={ref => (this._titleInput = ref)}
								/>
							</div>
						)}
						{commentType === "issue" && (
							<div
								ref={this._assigneesContainerRef}
								key="members"
								id="members-controls"
								className="control-group"
								style={{ marginBottom: "10px" }}
							>
								{/*
									There's some magic here. The specific control components for the issue provider,
									will render the input for assignees in here. And since those components aren't used
									while editing, a disabled input will be rendered here.
								*/}
								{this.props.isEditing && (
									<Select
										key="input-assignees2"
										id="input-assignees"
										name="assignees"
										classNamePrefix="react-select"
										isMulti
										isDisabled
										value={this.state.assignees}
									/>
								)}
							</div>
						)}
						{this.renderTextHelp()}
						{this.state.linkURI &&
							this.state.isPermalinkPublic && [
								<div key="permalink-warning" className="permalink-warning">
									<Icon name="alert" />
									Note that this is a public URL. Anyone with the link will be able to see the
									quoted code snippet.
								</div>
							]}
						{this.state.linkURI && [
							<textarea
								key="link-offscreen"
								ref={this.permalinkRef}
								value={this.state.linkURI}
								style={{ position: "absolute", left: "-9999px" }}
							/>,
							<input type="text" className="permalink" value={this.state.linkURI} />
						]}
						{commentType === "link" && !this.state.linkURI && (
							<div id="privacy-controls" className="control-group" key="1">
								<div className="public-private-hint" key="privacy-hint">
									{this.state.isPermalinkPublic
										? "Anyone can view this link, including the quoted codeblock."
										: "Only members of your team can access this link."}
								</div>
								<LabeledSwitch
									key="privacy"
									colored
									on={this.state.isPermalinkPublic}
									offLabel="Private"
									onLabel="Public"
									onChange={this.togglePermalinkPrivacy}
									height={28}
									width={80}
								/>
							</div>
						)}
						{commentType !== "bookmark" && commentType !== "link" && this.renderMessageInput()}
					</div>
					{false && (commentType === "comment" || commentType === "question") && (
						<div key="alert" className="checkbox-row" onClick={this.toggleNotify}>
							<input type="checkbox" checked={this.state.notify} /> Alert me if someone edits code
							in this range{"  "}
							<Tooltip title="Click to learn more">
								<span>
									<Icon className="clickable" onClick={this.showAlertHelp} name="info" />
								</span>
							</Tooltip>
						</div>
					)}
					{/* this.renderPrivacyControls() */}
					{this.renderRelatedCodemarks()}
					{this.renderTags()}
					{this.renderCodeBlocks()}
					{this.props.multiLocation && <div style={{ height: "10px" }} />}
					{commentType !== "link" && this.props.teamProvider === "codestream"
						? this.renderSharingControls()
						: this.renderCrossPostMessage(commentType)}
					{this.props.currentReviewId && this.renderRequireChange()}
					{true && (
						<div
							key="buttons"
							className="button-group"
							style={{
								marginLeft: "10px",
								marginTop: "10px",
								float: "right",
								width: "auto",
								marginRight: 0
							}}
						>
							<Tooltip title={cancelTip} placement="bottom" delay={1}>
								<Button
									key="cancel"
									style={{
										paddingLeft: "10px",
										paddingRight: "10px",
										width: "auto"
									}}
									className="control-button cancel"
									type="submit"
									onClick={() => this.props.onClickClose()}
								>
									{this.state.copied ? "Close" : "Cancel"}
								</Button>
							</Tooltip>
							<Tooltip title={submitTip} placement="bottom" delay={1}>
								<Button
									key="submit"
									style={{
										paddingLeft: "10px",
										paddingRight: "10px",
										// fixed width to handle the isLoading case
										width: "80px",
										marginRight: 0
									}}
									className="control-button"
									type="submit"
									loading={this.state.isLoading}
									onClick={this.state.linkURI ? this.copyPermalink : this.handleClickSubmit}
								>
									{commentType === "link"
										? this.state.copied
											? "Copied!"
											: this.state.linkURI
											? "Copy Link"
											: "Create Link"
										: "Submit"}
								</Button>
							</Tooltip>
							{/*
							<span className="hint">Styling with Markdown is supported</span>
						*/}
						</div>
					)}
					<div key="clear" style={{ clear: "both" }} />
				</fieldset>
			</form>
		];
		// 	<span className="hixnt" style={{ grid: "none" }}>
		// 	<input type="checkbox" />
		// 	Open automatically on selection
		// </span>
		// 	<input
		// 	id="radio-comment-type-snippet"
		// 	type="radio"
		// 	name="comment-type"
		// 	checked={commentType === "snippet"}
		// 	onChange={e => this.setCommentType("snippet")}
		// />
		// <label
		// 	htmlFor="radio-comment-type-snippet"
		// 	className={createClassString({
		// 		checked: commentType === "snippet"
		// 	})}
		// >
		// 	<Icon name="code" /> <span>Snippet</span>
		// </label>
	}
}

const EMPTY_OBJECT = {};

const mapStateToProps = (state: CodeStreamState): ConnectedProps => {
	const {
		context,
		editorContext,
		users,
		session,
		preferences,
		providers,
		codemarks,
		apiVersioning
	} = state;
	const user = users[session.userId!] as CSMe;
	const channel = context.currentStreamId
		? getStreamForId(state.streams, context.currentTeamId, context.currentStreamId) ||
		  getStreamForTeam(state.streams, context.currentTeamId)
		: getStreamForTeam(state.streams, context.currentTeamId);

	const teamMates = getTeamMates(state);
	const teamMembers = getTeamMembers(state);
	const teamTagsArray = getTeamTagsArray(state);

	const channelStreams = getChannelStreamsForTeam(state, context.currentTeamId);

	const directMessageStreams: CSDirectStream[] = (
		getDirectMessageStreamsForTeam(state.streams, context.currentTeamId) || []
	).map(stream => ({
		...(stream as CSDirectStream),
		name: getDMName(stream, toMapBy("id", teamMates), session.userId)
	}));

	return {
		channel,
		teamMates,
		teamMembers,
		currentTeamId: state.context.currentTeamId,
		shouldShare:
			safe(() => state.preferences[state.context.currentTeamId].shareCodemarkEnabled) || false,
		channelStreams: channelStreams,
		directMessageStreams: directMessageStreams,
		issueProvider: providers[context.issueProvider!],
		providerInfo: (user.providerInfo && user.providerInfo[context.currentTeamId]) || EMPTY_OBJECT,
		teamProvider: getCurrentTeamProvider(state),
		currentUser: user,
		selectedStreams: preferences.selectedStreams || EMPTY_OBJECT,
		showChannels: context.channelFilter,
		textEditorUri: editorContext.textEditorUri,
		textEditorSelection: getCurrentSelection(editorContext),
		teamTagsArray,
		codemarkState: codemarks,
		multipleMarkersEnabled: isFeatureEnabled(state, "multipleMarkers"),
		currentReviewId: context.currentReviewId
	};
};

const ConnectedCodemarkForm = connect(mapStateToProps)(CodemarkForm);

export { ConnectedCodemarkForm as CodemarkForm };
