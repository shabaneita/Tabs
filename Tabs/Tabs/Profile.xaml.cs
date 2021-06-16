using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

using Xamarin.Forms;
using Xamarin.Forms.Xaml;

namespace Tabs
{
    [XamlCompilation(XamlCompilationOptions.Compile)]
    public partial class Profile : ContentPage
    {
        public Profile()
        {
            InitializeComponent();
        }

        private void myLogout(object sender, EventArgs e)
        {
            Navigation.PopAsync();
        }

        private void registeragain(object sender, EventArgs e)
        {
            Navigation.PopToRootAsync();
        }
    }
}