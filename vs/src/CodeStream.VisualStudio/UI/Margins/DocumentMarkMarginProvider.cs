﻿using CodeStream.VisualStudio.Core;
using CodeStream.VisualStudio.Services;
using Microsoft.VisualStudio.Shell;
using Microsoft.VisualStudio.Text;
using Microsoft.VisualStudio.Text.Editor;
using Microsoft.VisualStudio.Text.Tagging;
using Microsoft.VisualStudio.Utilities;
using System;
using System.Collections.Generic;
using System.ComponentModel.Composition;
using System.Linq;
using CodeStream.VisualStudio.UI.Extensions;
using Microsoft.VisualStudio.ComponentModelHost;

namespace CodeStream.VisualStudio.UI.Margins {
	[Export(typeof(IWpfTextViewMarginProvider))]
	[Name(PredefinedCodestreamNames.DocumentMarkTextViewMargin)]
	[Order(After = PredefinedMarginNames.Glyph)]
	[MarginContainer(PredefinedMarginNames.Left)]
	[ContentType(ContentTypes.Text)]
	[TextViewRole(PredefinedTextViewRoles.Interactive)]
	[TextViewRole(PredefinedTextViewRoles.Document)]
	[TextViewRole(PredefinedTextViewRoles.PrimaryDocument)]
	[TextViewRole(PredefinedTextViewRoles.Editable)]
	internal sealed class DocumentMarkMarginProvider : ICodeStreamMarginProvider {
		private readonly IViewTagAggregatorFactoryService _viewTagAggregatorFactoryService;
		private readonly Lazy<IGlyphFactoryProvider, IGlyphMetadata>[] _glyphFactoryProviders;

		[ImportingConstructor]
		public DocumentMarkMarginProvider(IViewTagAggregatorFactoryService viewTagAggregatorFactoryService,
			[ImportMany] IEnumerable<Lazy<IGlyphFactoryProvider, IGlyphMetadata>> glyphFactoryProviders) {
			_viewTagAggregatorFactoryService = viewTagAggregatorFactoryService;

			// only get _our_ glyph factory
			_glyphFactoryProviders = Orderer.Order(glyphFactoryProviders)
				.Where(_ => _.Metadata.Name == PredefinedCodestreamNames.DocumentMarkGlyphFactoryProvider).ToArray();
		}

		[Import]
		public ITextDocumentFactoryService TextDocumentFactoryService { get; set; }

		public IWpfTextViewMargin CreateMargin(IWpfTextViewHost wpfTextViewHost, IWpfTextViewMargin parent) {
			try {
				if (wpfTextViewHost == null ||
				    !wpfTextViewHost.TextView.Roles.ContainsAll(TextViewRoles.DefaultRoles)) return null;
				if (!TextDocumentExtensions.TryGetTextDocument(TextDocumentFactoryService,
					wpfTextViewHost.TextView.TextBuffer, out var textDocument)) {
					return null;
				}

				var componentModel = Package.GetGlobalService(typeof(SComponentModel)) as IComponentModel;
				var sessionService = componentModel?.GetService<ISessionService>();
				var settingsService = componentModel?.GetService<ISettingsService>();

				TextViewMargin = new DocumentMarkMargin(
					_viewTagAggregatorFactoryService,
					_glyphFactoryProviders,
					wpfTextViewHost, sessionService, settingsService
				);

				return TextViewMargin;
			}
			catch (Exception ex) {
#if DEBUG
				System.Diagnostics.Debug.WriteLine(ex);
				System.Diagnostics.Debugger.Break();
#endif
				return null;
			}
		}

		public ICodeStreamWpfTextViewMargin TextViewMargin { get; private set; }
	}
}
