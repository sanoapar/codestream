﻿using System;
using System.Runtime.InteropServices;
using Microsoft.VisualStudio.Shell;

namespace CodeStream.VisualStudio
{
    /// <summary>
    /// This class implements the tool window exposed by this package and hosts a user control.
    /// </summary>
    /// <remarks>
    /// In Visual Studio tool windows are composed of a frame (implemented by the shell) and a pane,
    /// usually implemented by the package implementer.
    /// <para>
    /// This class derives from the ToolWindowPane class provided from the MPF in order to use its
    /// implementation of the IVsUIElementPane interface.
    /// </para>
    /// </remarks>
    [Guid("0fae43ec-bc2d-417e-af01-a477439cf228")]
    public class CodeStreamToolWindow : ToolWindowPane
    {
        public CodeStreamToolWindow() : base(null)
        {
            this.Caption = "CodeStream";

            // This is the user control hosted by the tool window; Note that, even if this class implements IDisposable,
            // we are not calling Dispose on this object. This is because ToolWindowPane calls Dispose on
            // the object returned by the Content property.
            this.Content = new CodeStreamToolWindowControl();
        }
    }
}