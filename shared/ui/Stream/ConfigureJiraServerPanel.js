import React, { Component } from "react";
import { injectIntl } from "react-intl";
import { connect } from "react-redux";
import { closePanel } from "./actions";
import { addEnterpriseProvider, connectProvider } from "../store/providers/actions";
import CancelButton from "./CancelButton";
import Tooltip from "./Tooltip";
import Button from "./Button";
import createClassString from "classnames";
import { isInVscode } from "../utils";
import VsCodeKeystrokeDispatcher from "../utilities/vscode-keystroke-dispatcher";
import { PROVIDER_MAPPINGS } from "./CrossPostIssueControls/types";

export class ConfigureJiraServerPanel extends Component {
	initialState = {
		baseUrl: "",
		baseUrlTouched: false,
		consumerKey: "",
		consumerKeyTouched: false,
		privateKey: "",
		privateKeyTouched: false,
		formTouched: false
	};

	state = this.initialState;
	wantProviderId = "";

	focusInput() {
		document.getElementById("configure-provider-initial-input").focus();
	}

	componentDidMount() {
		if (isInVscode()) {
			this.disposable = VsCodeKeystrokeDispatcher.on("keydown", event => {
				if (event.key === "Escape") {
					this.props.closePanel();
				}
			});
		}
		this.focusInput();
	}

	componentDidUpdate() {
		if (this.wantProviderId && this.props.providers[this.wantProviderId]) {
			this.props.connectProvider(this.wantProviderId, this.props.fromMenu);
			this.props.closePanel();
		}
	}
		
	onSubmit = async e => {
		e.preventDefault();
		if (this.isFormInvalid()) return;
		const { providerId } = this.props;
		let { baseUrl, consumerKey, privateKey } = this.state;
		baseUrl = baseUrl.toLowerCase();
		baseUrl = baseUrl.match(/^http/) ? baseUrl : `https://${baseUrl}`;
		const newProviderId = await this.props.addEnterpriseProvider(
			providerId, baseUrl, { oauthData: { consumerKey, privateKey } }
		);
		if (newProviderId) {
			this.wantProviderId = newProviderId;
		}
	};

	renderError = () => {};

	onBlurBaseUrl = () => {
		this.setState({ baseUrlTouched: true });
	};

	renderBaseUrlHelp = () => {
		const { baseUrl, baseUrlTouched, formTouched } = this.state;
		if (baseUrlTouched || formTouched) {
			if (baseUrl.length === 0) return <small className="error-message">Required</small>;
		}
	};

	onBlurConsumerKey = () => {
		this.setState({ consumerKeyTouched: true });
	};

	renderConsumerKeyHelp = () => {
		const { consumerKey, consumerKeyTouched, formTouched } = this.state;
		if (consumerKeyTouched || formTouched)
			if (consumerKey.length === 0) return <small className="error-message">Required</small>;
	};

	onBlurAppPrivateKey = () => {
		this.setState({ privateKeyTouched: true });
	};

	renderPrivateKeyHelp = () => {
		const { privateKey, privateKeyTouched, formTouched } = this.state;
		if (privateKeyTouched || formTouched)
			if (privateKey.length === 0) return <small className="error-message">Required</small>;
	};

	tabIndex = () => {};

	isFormInvalid = () => {
		return (
			this.state.baseUrl.length === 0 ||
			this.state.consumerKey.length === 0 ||
			this.state.privateKey.length === 0
		);
	};

	render() {
		const { providerId } = this.props;
		const inactive = false;
		const { name } = this.props.providers[providerId] || {};
		const providerName = PROVIDER_MAPPINGS[name] ? PROVIDER_MAPPINGS[name].displayName : "";
		const placeholder = PROVIDER_MAPPINGS[name] ? PROVIDER_MAPPINGS[name].urlPlaceholder : "";
		const getUrl = PROVIDER_MAPPINGS[name] ? PROVIDER_MAPPINGS[name].getUrl : "";
		return (
			<div className="panel configure-provider-panel">
				<form className="standard-form vscroll" onSubmit={this.onSubmit}>
					<div className="panel-header">
						<CancelButton onClick={this.props.closePanel} />
						<span className="panel-title">Configure {providerName}</span>
					</div>
					<fieldset className="form-body" disabled={inactive}>
						{getUrl && (
							<p style={{ textAlign: "center" }} className="explainer">
								Not a {providerName} customer yet? <a href={getUrl}>Get {providerName}</a>
							</p>
						)}
						{this.renderError()}
						<div id="controls">
							<div id="configure-enterprise-controls" className="control-group">
								<label><strong>{providerName} Base URL</strong></label>
								<label>Please provide the Base URL used by your team to access {providerName}.</label>
								<input
									className="native-key-bindings input-text control"
									type="text"
									name="baseUrl"
									tabIndex={this.tabIndex()}
									value={this.state.baseUrl}
									onChange={e => this.setState({ baseUrl: e.target.value })}
									onBlur={this.onBlurBaseUrl}
									required={this.state.baseUrlTouched || this.state.formTouched}
									placeholder={placeholder}
									required={true}
									id="configure-provider-initial-input"
								/>
								{this.renderBaseUrlHelp()}
							</div>
							<br/>
							<label>Please provide the consumer key and private key used to authorize your {providerName} credentials. You can obtain them from your {providerName} administrator.</label>
							<div id="app-clientid-controls" className="control-group">
								<label><strong>Consumer Key</strong></label>
								<input
									className="native-key-bindings input-text control"
									type="text"
									name="consumerKey"
									tabIndex={this.tabIndex()}
									value={this.state.consumerKey}
									onChange={e => this.setState({ consumerKey: e.target.value })}
									onBlur={this.onBlurConsumerKey}
									required={this.state.consumerKeyTouched || this.state.formTouched}
								/>
								{this.renderConsumerKeyHelp()}
							</div>
							<div id="app-clientsecret-controls" className="control-group">
								<label><strong>Private Key</strong></label>
								<textarea
									className="native-key-bindings input-text control"
									type="text"
									name="privateKey"
									tabIndex={this.tabIndex()}
									value={this.state.privateKey}
									onChange={e => this.setState({ privateKey: e.target.value })}
									onBlur={this.onBlurPrivateKey}
									required={this.state.privateKeyTouched || this.state.formTouched}
								/>
								{this.renderPrivateKeyHelp()}
							</div>
							<div className="button-group">
								<Button
									id="save-button"
									className="control-button"
									tabIndex={this.tabIndex()}
									type="submit"
									loading={this.state.loading}
								>
									Submit
								</Button>
								<Button
									id="discard-button"
									className="control-button cancel"
									tabIndex={this.tabIndex()}
									type="button"
									onClick={this.props.closePanel}
								>
									Cancel
								</Button>
							</div>
						</div>
					</fieldset>
				</form>
			</div>
		);
	}
}

const mapStateToProps = ({ providers }) => {
	return { providers };
};

export default connect(
	mapStateToProps,
	{ closePanel, addEnterpriseProvider, connectProvider }
)(injectIntl(ConfigureJiraServerPanel));
