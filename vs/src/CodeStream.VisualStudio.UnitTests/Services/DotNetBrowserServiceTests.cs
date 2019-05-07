﻿using System;
using System.Collections.Generic;
using System.Threading;
using CodeStream.VisualStudio.Events;
using CodeStream.VisualStudio.Services;
using Microsoft.VisualStudio.TestTools.UnitTesting;
using Moq;

namespace CodeStream.VisualStudio.UnitTests.Services {
	public static class MockFactory {
		public static T Create<T>() {
			return default(T);
		}
	}

	[TestClass]
	public class DotNetBrowserServiceTests {
		[TestMethod]
		public void DotNetBrowserServiceTest() {
			var codeStreamAgentServiceMock = new Mock<ICodeStreamAgentService>();
			var eventAggregator = new EventAggregator();
			codeStreamAgentServiceMock.Setup(_ => _.EventAggregator).Returns(eventAggregator);

			var browserService = new DotNetBrowserServiceStub(
				codeStreamAgentServiceMock.Object
			);

			browserService.PostMessage("lsp1", true);
			browserService.PostMessage("lsp2", true);
			browserService.PostMessage("lsp3", true);
			browserService.PostMessage("bootstrap");

			Assert.IsTrue(browserService.QueueCount > 0);
			Assert.IsTrue(browserService.QueueCount < 4);
			eventAggregator.Publish(new SessionReadyEvent());
			Thread.Sleep(1000);
			Assert.IsTrue(browserService.QueueCount == 0);
			Assert.IsTrue(browserService.Items[0] == "bootstrap");
			Assert.IsTrue(browserService.Items[1] == "lsp1");
			Assert.IsTrue(browserService.Items[2] == "lsp2");
			Assert.IsTrue(browserService.Items[3] == "lsp3");

			eventAggregator.Publish(new SessionLogoutEvent());

			Thread.Sleep(1000);
			browserService.Items.Clear();

			browserService.PostMessage("lsp1", true);
			browserService.PostMessage("lsp2", true);
			browserService.PostMessage("lsp3", true);
			browserService.PostMessage("bootstrap");

			eventAggregator.Publish(new SessionReadyEvent());
			Thread.Sleep(1000);
			Assert.IsTrue(browserService.QueueCount == 0);
			Assert.IsTrue(browserService.Items[0] == "bootstrap");
			Assert.IsTrue(browserService.Items[1] == "lsp1");
			Assert.IsTrue(browserService.Items[2] == "lsp2");
			Assert.IsTrue(browserService.Items[3] == "lsp3");

			browserService.Dispose();
		}

		[TestMethod()]
		public void DotNetBrowserServiceNormalThenQueuedTest() {
			var codeStreamAgentServiceMock = new Mock<ICodeStreamAgentService>();
			var eventAggregator = new EventAggregator();
			codeStreamAgentServiceMock.Setup(_ => _.EventAggregator).Returns(eventAggregator);

			var browserService = new DotNetBrowserServiceStub(
				codeStreamAgentServiceMock.Object
			);

			browserService.PostMessage("bootstrap1");
			browserService.PostMessage("bootstrap2");
			browserService.PostMessage("lsp1", true);
			browserService.PostMessage("lsp2", true);
			browserService.PostMessage("lsp3", true);
			browserService.PostMessage("bootstrap3");
			browserService.PostMessage("bootstrap4");

			Assert.IsTrue(browserService.QueueCount > 0);
			Assert.IsTrue(browserService.QueueCount < 4);
			eventAggregator.Publish(new SessionReadyEvent());
			Thread.Sleep(1000);
			Assert.IsTrue(browserService.QueueCount == 0);
			Assert.IsTrue(browserService.Items[0] == "bootstrap1");
			Assert.IsTrue(browserService.Items[1] == "bootstrap2");
			Assert.IsTrue(browserService.Items[2] == "bootstrap3");
			Assert.IsTrue(browserService.Items[3] == "bootstrap4");
			Assert.IsTrue(browserService.Items[4] == "lsp1");
			Assert.IsTrue(browserService.Items[5] == "lsp2");
			Assert.IsTrue(browserService.Items[6] == "lsp3");

			browserService.Dispose();
		}

		[TestMethod()]
		public void DotNetBrowserServiceNormalTest() {
			var eventAggregator = new EventAggregator();
			var codeStreamAgentServiceMock = new Mock<ICodeStreamAgentService>();
			codeStreamAgentServiceMock.Setup(_ => _.EventAggregator).Returns(eventAggregator);

			var browserService = new DotNetBrowserServiceStub(
				codeStreamAgentServiceMock.Object
			);

			browserService.PostMessage("bootstrap1");
			//goes through -- no queue
			Assert.IsTrue(browserService.QueueCount == 0);
			eventAggregator.Publish(new SessionReadyEvent());
			browserService.PostMessage("bootstrap2");
			//goes through -- no queue
			Assert.IsTrue(browserService.QueueCount == 0);
			eventAggregator.Publish(new SessionLogoutEvent());
			browserService.PostMessage("bootstrap3");
			Thread.Sleep(1);
			eventAggregator.Publish(new SessionReadyEvent());
			Thread.Sleep(1);
			Assert.IsTrue(browserService.QueueCount == 0);

			Assert.IsTrue(browserService.Items[0] == "bootstrap1");
			Assert.IsTrue(browserService.Items[1] == "bootstrap2");
			Assert.IsTrue(browserService.Items[2] == "bootstrap3");
			browserService.Dispose();
		}

		[TestMethod()]
		public void DotNetBrowserServiceReloadTest() {
			var codeStreamAgentServiceMock = new Mock<ICodeStreamAgentService>();
			var eventAggregator = new EventAggregator();
			codeStreamAgentServiceMock.Setup(_ => _.EventAggregator).Returns(eventAggregator);

			var browserService = new DotNetBrowserServiceStub(
				codeStreamAgentServiceMock.Object
			);

			browserService.PostMessage("bootstrap1");
			Assert.IsTrue(browserService.QueueCount == 0);
			for (var i = 0; i < 200; i++) {
				browserService.PostMessage($"data{i}", true);
			}
			eventAggregator.Publish(new SessionReadyEvent());
			SpinWait.SpinUntil(() => browserService.WasReloaded, 2000);
			Assert.AreEqual(true, browserService.WasReloaded);
			browserService.Dispose();
		}
	}

	public class DotNetBrowserServiceStub : DotNetBrowserService {
		public List<string> Items { get; }

		public DotNetBrowserServiceStub(
			ICodeStreamAgentService agentService) :
			base(agentService) {
			Items = new List<string>();
		}

		protected override void Send(string message) {
			Items.Add(message);
#if DEBUG
			Console.WriteLine($"processed:{message}");
#endif
		}

		public bool WasReloaded { get; private set; }
		public override void ReloadWebView() {
			WasReloaded = true;
		}
	}
}
