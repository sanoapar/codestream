﻿using CodeStream.VisualStudio.Core.Models;
using Newtonsoft.Json.Linq;

namespace CodeStream.VisualStudio.Core.Services {
	public interface IAuthenticationService {
		System.Threading.Tasks.Task LogoutAsync(SessionSignedOutReason reason, JToken payload = null);
	}
}
