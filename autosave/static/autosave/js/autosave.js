var DjangoAutosave = (window.DjangoAutosave) ? DjangoAutosave : {};

(function($) {

    $(document).ready(function() {
        DjangoAutosave.setUp();
    });

    $(document).on('click', '[href=#ignore-autosaved]', function(e) {
        // Clicking this should remove the banner and start autosaving again, replacing
        // the old version.
        e.preventDefault();
        $(e.target).closest('li').fadeOut('fast');
        DjangoAutosave.save();
        window.setInterval(DjangoAutosave.save, 5000);
    });

    $(document).on('click', '[href=#revert-to-autosaved]', function(e) {
        // Regenerates the form to submit old data, and posts it.
        e.preventDefault();
        // Handle banner
        var $btn = $(e.target);
        var $banner = $btn.closest('p');
        $banner.text("Reverting to your saved version. Be right back...");
        
        // Generate new form data
        var $form = $('form');
        // Disable the existing form
        $form.find(':input:not([name="csrfmiddlewaretoken"])').prop('disabled', true);
        var data = DjangoAutosave.retrieve()[0];

        $.each(data, function(i, attributes) {
            $('<input type="hidden" />').attr(attributes).appendTo($form);
        });

        // The CSRF token can change and cause 403's. Always use the current one.
        if (DjangoAutosave.csrf_token) {
            $(':input[name="csrfmiddlewaretoken"]').val(DjangoAutosave.csrf_token);
        }
        function addAutoSaveRetrieveField() {
            // This adds an element to the page that tells Django forms
            // to deliberately fail validation, and return the autosaved contents.
            var input = $('<input type="hidden" name="is_retrieved_from_autosave" value="1" />');
            $('form').append(input);
        }

        // This adds an element to the page that tells Django forms
        // to deliberately fail validation, and return the autosaved contents.
        $form.append($('<input type="hidden" name="is_retrieved_from_autosave" value="1"/>'));
        $form.submit();
    });

    DjangoAutosave.setUp = function() {
        if (typeof DjangoAutosave.config != 'object') {
            return false;
        }


        function pageIsChangeListView(){
            return $('#changelist-form').length == 1;
        }
        if (window.localStorage === undefined || pageIsChangeListView()) {
            // Requires local storage.
            return false;
        }

        DjangoAutosave.csrf_token = $('[name="csrfmiddlewaretoken"]').val();

        var data = DjangoAutosave.config;

        if (data.last_updated_epoch === null) {
            // No date means this object doesn't exist yet.
            return false;
        }
        // An arbitrary margin of error to deal with clock sync
        var last_updated = parseInt(data.last_updated_epoch, 10) + data.client_time_offset + 15;
        var last_autosaved = DjangoAutosave.retrieve()[1];

        // If last_updated is more recent, than this story was probably edited by someone else/another device.
        // If the content is not different, the user probably just closed a window or went to get coffee and close a tab,
        // but had already saved their work.
        if (!data.is_recovered_autosave && last_autosaved > last_updated && DjangoAutosave.contentIsDifferent()) {
            // Suggest revert
            DjangoAutosave.suggestRevert(last_autosaved);
        } else {
            // Start Saving Again
            window.setInterval(DjangoAutosave.save, 5000);
        }
    };


    DjangoAutosave.contentIsDifferent = function() {
        // Determines if the autosaved data is different than the current version.

        var saved = DjangoAutosave.retrieve()[0];
        var current = DjangoAutosave.captureForm();

        // If they're not even the same length, they're different.
        if (saved.length !== current.length) {
            return true;
        }
        for (var i = saved.length - 1; i >= 0; i--) {
            // Skip comparison of the csrfmiddlewaretoken value
            if (saved[i].name === 'csrfmiddlewaretoken') { continue; }
            if (saved[i].value !== current[i].value) {
                // The values for fields should be identical
                return true;
            }
        }
        return false;
    };

    DjangoAutosave.suggestRevert = function(last_autosaved) {
        var msg = [
            "It looks like you have a more recent version autosaved at ",
            Date(last_autosaved).toLocaleString(),
            ". <a href='#revert-to-autosaved'>Revert to that</a> or",
            " <a href='#ignore-autosaved'>continue with this version</a>?"
        ].join('');
        var $alert = $('<li class="warning"/>').hide().html(msg);
        // $alert.hide();
        // $alert.html(msg);

        // 'grp-' prefix to support both Admin and Grapelli 2.4
        var $messagelist = $('.messagelist, .grp-messagelist');
        var $container = $('#content, #content-inner');
        if (!$messagelist.length) {
            // Put messagelist in place if it's not already there
            $messagelist = $('<ul class="messagelist grp-messagelist"/>').prependTo($container);
        }
        $messagelist.append($alert);
        $alert.fadeIn();
    };

    DjangoAutosave.getFormName = function() {
        // Key names are unique to the page/uri
        return "autosaved_form.data:" + window.location.pathname;
    };
    DjangoAutosave.getTimeStampName = function() {
        // Key names are unique to the page/uri
        return "autosaved_form.timestamp:" + window.location.pathname;
    };
    
    DjangoAutosave.captureForm = function() {
        var $form = $('form');
        var fields = $form.find(':input:not([name="csrfmiddlewaretoken"])');
        field_list = [];
        var $field;
        for (var i = fields.length - 1; i >= 0; i--) {
            $field = $(fields[i]);
            var name = $field.attr('name');
            if (name) {
                field_list.push({ 'name': name, 'value': $field.val() });
            }
            // Val has to come from JQuery because CKeditor hooks it's update function in there.
        }
        return field_list;
        // return JSON.stringify(field_list);
    };

    DjangoAutosave.save = function() {
        var data = DjangoAutosave.captureForm();
        localStorage.setItem(DjangoAutosave.getFormName(), JSON.stringify(data));
        localStorage.setItem(DjangoAutosave.getTimeStampName(), Math.round((new Date()).getTime()/1000, 0));
    };

    DjangoAutosave.retrieve = function() {
        // Get what's in storage
        var data = localStorage.getItem(DjangoAutosave.getFormName());
        var timestamp = localStorage.getItem(DjangoAutosave.getTimeStampName());
        return [$.parseJSON(data), parseInt(timestamp, 10) || null];
    };

    DjangoAutosave.clear = function() {
        localStorage.removeItem(DjangoAutosave.getFormName());
        localStorage.removeItem(DjangoAutosave.getTimeStampName());
    };

})(django.jQuery); // Must use Django jQuery because Django-CKEditor modifies it.
