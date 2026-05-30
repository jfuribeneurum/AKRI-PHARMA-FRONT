import { Component, OnInit, signal, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../core/api.service';

@Component({
  selector: 'akri-admin',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule],
  templateUrl: './admin.component.html',
  styleUrls: ['./admin.component.css']
})
export class AdminComponent implements OnInit {
  readonly message = signal('');
  readonly error = signal('');
  readonly sites = signal<any[]>([]);
  readonly profiles = signal<any[]>([]);
  readonly users = signal<any[]>([]);
  readonly warehouses = signal<any[]>([]);

  userSearch = '';

  permissionOptions = [
    { key: 'perm_inventario_consulta', label: 'Inventario consulta' },
    { key: 'perm_inventario_movimiento', label: 'Inventario movimiento' },
    { key: 'perm_inventario_ajuste', label: 'Inventario ajuste' },
    { key: 'perm_compras_solicitar', label: 'Compras solicitar' },
    { key: 'perm_compras_aprobar', label: 'Compras aprobar' },
    { key: 'perm_compras_recibir', label: 'Compras recibir' },
    { key: 'perm_ventas_dispensar', label: 'Dispensar' },
    { key: 'perm_ventas_facturar', label: 'Facturar' },
    { key: 'perm_controlados_dispensar', label: 'Controlados' },
    { key: 'perm_controlados_libro', label: 'Libro controlados' },
    { key: 'perm_cadena_frio_consulta', label: 'Frío consulta' },
    { key: 'perm_cadena_frio_registro', label: 'Frío registro' },
    { key: 'perm_cadena_frio_aprobar_excursion', label: 'Frío excursiones' },
    { key: 'perm_reportes_operativos', label: 'Reportes operativos' },
    { key: 'perm_reportes_financieros', label: 'Reportes financieros' },
    { key: 'perm_configuracion', label: 'Configuración' },
    { key: 'perm_usuarios_gestionar', label: 'Gestionar usuarios' },
    { key: 'perm_auditoria_consulta', label: 'Auditoría' }
  ];

  siteForm: any = this.blankSite();
  profileForm: any = this.blankProfile();
  userForm: any = this.blankUser();

  constructor(private readonly api: ApiService) {}

  ngOnInit() {
    void this.load();
  }

  async load() {
    try {
      this.error.set('');
      this.message.set('');
      const [lookups, sites, profiles] = await Promise.all([
        this.api.get<{ success: boolean; data: any }>('/admin/lookups'),
        this.api.get<{ success: boolean; data: any[] }>('/admin/sites'),
        this.api.get<{ success: boolean; data: any[] }>('/admin/profiles')
      ]);

      this.sites.set(sites.data);
      this.profiles.set(profiles.data);
      this.warehouses.set(lookups.data.warehouses ?? []);
      await this.loadUsers();
    } catch (error: any) {
      this.error.set(error?.error?.message || 'No fue posible cargar la administración.');
    }
  }

  async loadUsers() {
    try {
      const response = await this.api.get<{ success: boolean; data: any[] }>(`/admin/users?search=${encodeURIComponent(this.userSearch)}`);
      this.users.set(response.data);
    } catch (error: any) {
      this.error.set(error?.error?.message || 'No fue posible cargar usuarios.');
    }
  }

  async saveSite() {
    try {
      this.error.set('');
      if (this.siteForm.id_sede) {
        await this.api.put(`/admin/sites/${this.siteForm.id_sede}`, this.siteForm);
        this.message.set('Sede actualizada.');
      } else {
        await this.api.post('/admin/sites', this.siteForm);
        this.message.set('Sede creada.');
      }
      this.resetSiteForm();
      await this.load();
    } catch (error: any) {
      this.error.set(error?.error?.message || 'No fue posible guardar la sede.');
    }
  }

  async saveProfile() {
    try {
      this.error.set('');
      if (this.profileForm.id_rol) {
        await this.api.put(`/admin/profiles/${this.profileForm.id_rol}`, this.profileForm);
        this.message.set('Perfil actualizado.');
      } else {
        await this.api.post('/admin/profiles', this.profileForm);
        this.message.set('Perfil creado.');
      }
      this.resetProfileForm();
      await this.load();
    } catch (error: any) {
      this.error.set(error?.error?.message || 'No fue posible guardar el perfil.');
    }
  }

  async saveUser() {
    try {
      this.error.set('');
      const payload = {
        ...this.userForm,
        site_ids: this.userForm.site_ids
      };
      if (this.userForm.id_usuario) {
        if (!payload.password) {
          delete payload.password;
        }
        await this.api.put(`/admin/users/${this.userForm.id_usuario}`, payload);
        this.message.set('Usuario actualizado.');
      } else {
        await this.api.post('/admin/users', payload);
        this.message.set('Usuario creado.');
      }
      this.resetUserForm();
      await this.load();
    } catch (error: any) {
      this.error.set(error?.error?.message || 'No fue posible guardar el usuario.');
    }
  }

  editSite(row: any) {
    this.siteForm = { ...row };
  }

  editProfile(row: any) {
    const next = this.blankProfile();
    for (const key of Object.keys(next)) {
      if (row[key] !== undefined) {
        next[key] = row[key];
      }
    }
    next.id_rol = row.id_rol;
    this.profileForm = next;
  }

  editUser(row: any) {
    this.userForm = {
      id_usuario: row.id_usuario,
      username: row.username,
      password: '',
      nombre: row.nombre,
      apellido_paterno: row.apellido_paterno,
      apellido_materno: row.apellido_materno,
      email: row.email,
      telefono_movil: row.telefono_movil,
      id_rol: row.id_rol,
      id_sede: row.id_sede,
      id_almacen_principal: row.id_almacen_principal,
      numero_empleado: row.numero_empleado,
      cedula_profesional: row.cedula_profesional,
      fecha_ingreso: row.fecha_ingreso,
      es_activo: row.es_activo,
      requiere_cambio_password: false,
      puede_admin_sede: Boolean(row.access?.some((item: any) => item.puede_admin_sede)),
      site_ids: (row.access ?? []).map((item: any) => Number(item.id_sede))
    };
  }

  warehousesBySelectedSite() {
    return this.warehouses().filter((row) => !this.userForm.id_sede || Number(row.id_sede) === Number(this.userForm.id_sede));
  }

  userHasSite(idSede: number) {
    return (this.userForm.site_ids ?? []).includes(idSede);
  }

  toggleUserSite(idSede: number, checked: boolean) {
    const current = new Set<number>((this.userForm.site_ids ?? []).map((value: any) => Number(value)));
    if (checked) {
      current.add(Number(idSede));
    } else {
      current.delete(Number(idSede));
    }
    this.userForm.site_ids = Array.from(current);
  }

  resetSiteForm() {
    this.siteForm = this.blankSite();
  }

  resetProfileForm() {
    this.profileForm = this.blankProfile();
  }

  resetUserForm() {
    this.userForm = this.blankUser();
  }

  private blankSite() {
    return {
      id_sede: null,
      codigo: '',
      nombre: '',
      ciudad: '',
      direccion: '',
      telefono: '',
      email: '',
      responsable: '',
      es_principal: false,
      activo: true
    };
  }

  private blankProfile() {
    const form: any = {
      id_rol: null,
      nombre: '',
      descripcion: '',
      nivel_jerarquia: 5,
      es_activo: true
    };
    for (const option of this.permissionOptions) {
      form[option.key] = false;
    }
    return form;
  }

  private blankUser() {
    return {
      id_usuario: null,
      username: '',
      password: '',
      nombre: '',
      apellido_paterno: '',
      apellido_materno: '',
      email: '',
      telefono_movil: '',
      id_rol: null,
      id_sede: null,
      id_almacen_principal: null,
      numero_empleado: '',
      cedula_profesional: '',
      fecha_ingreso: '',
      es_activo: true,
      requiere_cambio_password: false,
      puede_admin_sede: false,
      site_ids: []
    };
  }
}
